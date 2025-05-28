// Synchronous getter that uses cached files in global fileCache
// This is workaround to make it synchronous same as in GAS and node readFileSync
export function getFileUint8(id) {
  if (!fileCache[id]) {
    console.error(`File not preloaded: ${id}`);
    return new Uint8Array(0);
  }
  return fileCache[id];
}

export function getImgUint8(imgId) {
  return getFileUint8(imgId);
}

/**
 * Creates an iterator for all images on the page
 * @returns {Object} Iterator with .hasNext() and .next() methods
 */
export function getImageIterator(imageIds = []) {
  // Get all images in the document
  // If image ids are specified, filter out the rest
  let images = Array.from(document.querySelectorAll('img'));
  if (imageIds && imageIds.length > 0){
    images = images.filter(img => imageIds.indexOf(img.id) > -1);
  }
  let currentIndex = 0;

  return {
    /**
     * Check if there are more images to process
     * @returns {boolean} True if there are more images
     */
    hasNext: function() {
      return currentIndex < images.length;
    },

    next: function() {
      if (!this.hasNext()) {
        return null;
      }
      return images[currentIndex++].id;
    }
  };
}


// Program constructor that takes a WebGL context and script tag IDs
// to extract vertex and fragment shader source code from the page
export class Program {
  constructor(gl, vertexShaderId, fragmentShaderId) {
      this.gl = gl;
      this.program = gl.createProgram();

      if (!(vertexShaderId && fragmentShaderId)) {
          throw new Error("No shader IDs were provided");
      }

      gl.attachShader(this.program, this.getShader(vertexShaderId));
      gl.attachShader(this.program, this.getShader(fragmentShaderId));
      gl.linkProgram(this.program);
      // gl.validateProgram(this.program);

      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
          throw new Error("Could not initialize shaders." + gl.getProgramInfoLog(this.program));
      }

      // eslint-disable-next-line no-console
      console.log(
          "constructed program status",
          gl.getProgramParameter(this.program, gl.LINK_STATUS)
      );

      gl.useProgram(this.program);
  }

  useProgram() {
      this.gl.useProgram(this.program);
  }

  load(attributes, uniforms) {
      this.gl.useProgram(this.program);
      this.setAttributeLocations(attributes);
      this.setUniformLocations(uniforms);
  }

  // called from .load(a,u)
  // Set references to attributes onto the program instance
  setAttributeLocations(attributes) {
      attributes.forEach((attribute) => {
          this[attribute] = this.gl.getAttribLocation(
              this.program,
              attribute
          );
          // gl.enableVertexAttribArray(attributes[attributeName]); // from webgl prev version
      });
  }

  // called from .load(a,u)
  setUniformLocations(uniforms) {
      uniforms.forEach((uniform) => {
          this[uniform] = this.gl.getUniformLocation(this.program, uniform);
          // gl.enableVertexAttribArray(attributes[uniformName]); // from webgl prev version
      });

      this.logUniforms(uniforms);
  }

  getUniform(uniformLocation) {
      return this.gl.getUniform(this.program, uniformLocation);
  }

  // log uniform addresses
  logUniforms(uniforms) {
      // const numUniforms = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_UNIFORMS);
      // for (let i = 0; i < numUniforms; ++i) {
      //     const info = this.gl.getActiveUniform(this.program, i);
      //     let uniformsLocation = this.gl.getUniformLocation(this.program, info.name);
      // }
      uniforms.forEach((uniform) => {
          // eslint-disable-next-line no-console
          console.log("uniforms given", uniform, this[uniform]);
      });
  }

  // Given an id for a shader script, return a compiled shader
  getShader(id) {
      const script = document.getElementById(id);
      if (!script) {
          return null;
      }

      const shaderString = script.text.trim();

      let shader;
      if (script.type === "x-shader/x-vertex") {
          shader = this.gl.createShader(this.gl.VERTEX_SHADER);
      } else if (script.type === "x-shader/x-fragment") {
          shader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
      } else {
          return null;
      }

      this.gl.shaderSource(shader, shaderString);
      this.gl.compileShader(shader);

      if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
          throw new Error(`Problem compiling shader with id ${id}`, this.gl.getShaderInfoLog(shader));
      }

      return shader;
  }
}


// Encapsulates creating of WebGL textures
export class Texture {
  constructor(gl, slot,
      config = {
        source: null,
        flip: false,
        mipmap: false,
        params: {},
        width,
        height,
        depth,
        isFloat: false
  }) {
    this.gl = gl;
    this.slot = slot;
    this.width = config.width;
    this.height = config.height;
    this.depth = config.depth;
    this.isFloat = config.isFloat;
    this.flip = config.flip;
    this.mipmap = config.mipmap;
    this.params = config.params;

    this.glTexture = null;

    this.type = this.isFloat ? this.gl.FLOAT : this.gl.UNSIGNED_BYTE;

    if (this.isFloat) {
      // High-precision floating point format for coordinates
      this.internalFormat = this.gl.RGBA32F;
      this.format = this.gl.RGBA;
    } else if (this.depth === 1 || this.depth === 8) {
      // Single channel formats (grayscale, binary)
      this.internalFormat = this.gl.R8;
      this.format = this.gl.RED;
    } else if (this.depth === 24) {
      // RGB format (3 channels)
      this.internalFormat = this.gl.RGB8;
      this.format = this.gl.RGB;
    } else if (this.depth === 32) {
      // RGBA format (4 channels)
      this.internalFormat = this.gl.RGBA8; // this.gl.RGBA32F, this.gl.FLOAT,
      this.format = this.gl.RGBA;
    } else {
      console.warn(`Unsupported bit depth: ${this.depth}, defaulting to 8-bit grayscale`);
      this.internalFormat = this.gl.R8;
      this.format = this.gl.RED;
    }
  }

  init() {

      this.glTexture = this.gl.createTexture();
      this.gl.activeTexture(this.gl.TEXTURE0 + this.slot);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.glTexture);

      Object.entries(this.params).forEach((pair) => {
          this.gl.texParameteri(
              this.gl.TEXTURE_2D,
              this.gl[pair[0]],
              this.gl[pair[1]]
          );
      });

      if (this.flip) {
          this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
      }
      if (this.mipmap) {
          this.gl.generateMipmap(this.gl.TEXTURE_2D);
      }
      // Clean
      this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }

  update(pixelData) {
    this.gl.activeTexture(this.gl.TEXTURE0 + this.slot);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.glTexture);


    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,                 // mipmap level
      this.internalFormat,    // internal format
      this.width,
      this.height,
      0,                 // border (must be 0, always)
      this.format,       // format
      this.type,         // type
      pixelData
    );
  }

  activate() {
    this.gl.activeTexture(this.gl.TEXTURE0 + this.slot);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.glTexture);
  }
}


export class ProcessingWEBGL {
  constructor(
      width,
      height,
      depth,
      packW = Math.ceil(width/8),
      packH = Math.ceil(height/4),
      /**
      *       V0              V1
              (0, 0)         (1, 0)
              X-----------------X
              |                 |
              |     (0, 0)      |
              |                 |
              X-----------------X
              (0, 1)         (1, 1)
              V3               V2
      */
      texPosition = new Float32Array([
                            0, 0, // bottom-left
                            1, 0, // bottom-right
                            0,  1, // top-left
                            1,  1, // top-right
                          ]),
      texIndices = new Uint16Array([0, 1, 2, 2, 1, 3]), // indices of triangle corners
      programs = [
        { // 0 - packing
          vertexShaderId: "shader-vs",
          fragmentShaderId: "packing-fs",
          attrs: {
              a_position: texPosition
          },
          vaoIndices: texIndices,
          uniforms: {
            u_texture: 0
          }
        },
        { // 1 - unpacking
          vertexShaderId: "shader-vs",
          fragmentShaderId: "unpacking-fs",
          attrs: {
              a_position: texPosition
          },
          vaoIndices: texIndices,
          uniforms: {
            p_texture: 5
          }
        },
        { // 2 - comparison
          vertexShaderId: "shader-vs",
          fragmentShaderId: "comparison-fs",
          attrs: {
              a_position: texPosition
          },
          vaoIndices: texIndices,
          uniforms: {
            src_texture: 1,
            p_texture: 5,
            u_threshold: 0.01
          }
        },
        { // 3 - copy
          vertexShaderId: "shader-vs",
          fragmentShaderId: "copy-fs",
          attrs: {
              a_position: texPosition
          },
          vaoIndices: texIndices,
          uniforms: {
            up_texture: 3
          }
        },
        { // 4 - processing
          vertexShaderId: "shader-vs",
          fragmentShaderId: "processing-fs",
          attrs: {
              a_position: texPosition
          },
          vaoIndices: texIndices,
          uniforms: {
            p_texture: 1
          }
        }
      ],
      textureOptions = [
        { // 0 - original image
          source: null,
          flip: true,
          mipmap: false,
          width, // should take value from above constructor param
          height,
          depth,
          params: {
              TEXTURE_WRAP_T: "CLAMP_TO_EDGE",
              TEXTURE_WRAP_S: "CLAMP_TO_EDGE",
              TEXTURE_MAG_FILTER: "NEAREST",
              TEXTURE_MIN_FILTER: "NEAREST",
          }
        },
        { // 1 - packed texture
          source: null,
          flip: false,
          mipmap: false,
          width: packW,
          height: packH,
          depth,
          params: {
              TEXTURE_WRAP_T: "REPEAT",
              TEXTURE_WRAP_S: "REPEAT",
              TEXTURE_MAG_FILTER: "NEAREST",
              TEXTURE_MIN_FILTER: "NEAREST",
          }
        },
        // Without proper filtering parameters, textures can be considered "incomplete" for framebuffer use
        // The framebuffer might still report as complete, but the rendering won't work
        // This is especially common when the default min filter expects mipmaps that don't exist
        { // 2 - debugging framebuffer attachment
          source: null,
          flip: false,
          mipmap: false,
          width: packW,
          height: packH,
          depth,
          isFloat: true, // use RGBA32F for coordinates
          params: {
                  TEXTURE_MAG_FILTER: "NEAREST",
                  TEXTURE_MIN_FILTER: "NEAREST",
          }
        },
        { // 3 - unpacked texture
          source: null,
          flip: true,
          mipmap: false,
          width,
          height,
          depth,
          params: {
                  TEXTURE_MAG_FILTER: "NEAREST",
                  TEXTURE_MIN_FILTER: "NEAREST",
          }
        },
        { // 4 - occlusion framebuffer attachment for texture comparison
          source: null,
          flip: false,
          mipmap: false,
          width,
          height,
          depth,
          params: {
                  TEXTURE_MAG_FILTER: "NEAREST",
                  TEXTURE_MIN_FILTER: "NEAREST",
          }
        },
        { // 5 - packed processed texture
          source: null,
          flip: false,
          mipmap: false,
          width: packW,
          height: packH,
          depth,
          params: {
              TEXTURE_WRAP_T: "REPEAT",
              TEXTURE_WRAP_S: "REPEAT",
              TEXTURE_MAG_FILTER: "NEAREST",
              TEXTURE_MIN_FILTER: "NEAREST",
          }
        }
      ],
      framebuffers = {
        packing: [
            {attachmentSlot: 0, textureSlot: 1},
            {attachmentSlot: 1, textureSlot: 2}, // coordinates
          ],
        unpacking: [
            {attachmentSlot: 0, textureSlot: 3}
          ],
        occlusion: [
            {attachmentSlot: 0, textureSlot: 4}
          ],
        processing: [
            {attachmentSlot: 0, textureSlot: 5}
          ]
      }
  ) {

    this.w = width;
    this.h = height;
    this.packW = packW;
    this.packH = packH;
    this.fbConfigs = framebuffers;

    this.progs = [];
    this.textures = [];
    this.buffers = [];
    this.framebuffers = {};

    // Create canvas and get WebGL2 context
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    this.gl = canvas.getContext('webgl2', {
        antialias: false,
        willReadFrequently: true,
    });

    if (!this.gl) {
      console.error("WebGL2 not supported");
      return null;
    }

    this.gl.viewport(0, 0, width, height);

    for(let i = 0; i < programs.length; i++){
      let p = programs[i];
      try {
        this.progs[i] = new Program(this.gl, p.vertexShaderId, p.fragmentShaderId);
        this.progs[i].load(Object.keys(p.attrs), Object.keys(p.uniforms)); // includes useProgram
      } catch (e) {
        console.log(e);
      }
    }

    for (let slot = 0; slot < textureOptions.length; slot++){
      let tx = textureOptions[slot];
      try {
          this.textures[slot] = new Texture(this.gl, slot, tx);
      } catch (e) {
          console.error(e);
      }
    }

    // The extension tells us if we can use single component R32F texture format.
    // Important for FRAMEBUFFER_COMPLETE, makes renderbufferStorage() accept R32F.
    // Needed if we need to save position vectors for example. WebGL2:
    this.gl.color_buffer_float_ext = this.gl.getExtension(
      "EXT_color_buffer_float"
    );
    // WebGL1: gl.getExtension("OES_texture_float");
    this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
    this.gl.clearDepth(1.0);
    this.gl.disable(this.gl.DEPTH_TEST);

    // plain 2D canvas for debugging framebuffer
    const debugCanvas = document.createElement('canvas');
    debugCanvas.width = width;
    debugCanvas.height = height;
    this.ctx_debug = debugCanvas.getContext("2d", {
        antialias: false,
        willReadFrequently: true,
    });

    const isMono = depth === 1 || depth === 8;
    this.readPixels = isMono ? this.readPixelsDepth : this.readPixelsRGB;
    this.pixelsTo2DCanvas = isMono
        ? this.pixelsTo2DCanvasDepth : this.pixelsTo2DCanvasRGB;


    for (let slot = 0; slot < this.textures.length; slot++){
      try {
          this.textures[slot].init();
      } catch (e) {
          console.error(e);
      }
    }
    for (let progSlot = 0; progSlot < this.progs.length; progSlot++) {
      this.initUniforms(progSlot, programs[progSlot].uniforms);
      this.initBuffers(progSlot, programs[progSlot]);
    }
    Object.keys(framebuffers).forEach( fbName => {
      this.initFramebuffer(fbName);
    });

    document.body.appendChild(canvas);
    document.body.appendChild(debugCanvas);
    return this;
  }


  initUniforms(progSlot, uniValues) {
    this.progs[progSlot].useProgram();
    Object.keys(uniValues).forEach( uniName =>{
      const uVal = uniValues[uniName];
      if (Array.isArray(uVal) && uVal.length === 2) {
        this.gl.uniform2fv(this.progs[progSlot][uniName], uVal);
      } else if (Number.isInteger(uVal)) {
        this.gl.uniform1i(this.progs[progSlot][uniName], uVal);
      } else {
        this.gl.uniform1f(this.progs[progSlot][uniName], uVal);
      }
    });
  }

  initBuffers(progSlot, buffData) {
      this.buffers[progSlot] = {
        indices_len: buffData.vaoIndices.length, // store data needed for each draw()
        vertsVAO: this.gl.createVertexArray() // Create VAO instance
      };

      // Bind it so we can work on it
      this.gl.bindVertexArray(this.buffers[progSlot].vertsVAO); // repeat this on each draw()

      Object.keys(buffData.attrs).forEach(attrName => {
        const buff = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buff);
        this.gl.bufferData(
            this.gl.ARRAY_BUFFER,
            buffData.attrs[attrName], // data
            this.gl.STATIC_DRAW
        );
        // vertices VAO
        // Now we additionally provide instructions for VAO to use data later in draw()
        // benefit: one time on init *instead* of each draw()
        this.gl.enableVertexAttribArray(this.progs[progSlot][attrName]);
        this.gl.vertexAttribPointer(
          this.progs[progSlot][attrName], // location
            2, // size
            this.gl.FLOAT,
            false,
            0,
            0
        );
      });
      // Setting up the IBO
      const indsBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indsBuffer);
      // here we set indices: only inds.length is needed on each draw()
      this.gl.bufferData(
          this.gl.ELEMENT_ARRAY_BUFFER,
          buffData.vaoIndices,
          this.gl.STATIC_DRAW
      );

      // Clean
      this.gl.bindVertexArray(null);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
  }

  initFramebuffer(fbName) {
    let attachments = this.fbConfigs[fbName];
    console.log("initFramebuffer", fbName, attachments);

    this.framebuffers[fbName] = this.gl.createFramebuffer();
    console.log("Created framebuffer", this.framebuffers[fbName]);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffers[fbName]);

    attachments.forEach( attachment => {
      this.textures[attachment.textureSlot].update(null); // create empty texture
      this.gl.framebufferTexture2D(
          this.gl.FRAMEBUFFER,
          this.gl.COLOR_ATTACHMENT0 + attachment.attachmentSlot,
          this.gl.TEXTURE_2D,
          this.textures[attachment.textureSlot].glTexture,
          0
      );
    });

    this.checkFramebufferStatus(fbName);

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }

  checkFramebufferStatus(fbName) {
    const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
    if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
      console.error(`Framebuffer incomplete: ${status}`);
      // Convert status code to readable message
      const statusMap = {
        36054: "FRAMEBUFFER_INCOMPLETE_ATTACHMENT",
        36055: "FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT",
        36056: "FRAMEBUFFER_INCOMPLETE_DIMENSIONS",
        36057: "FRAMEBUFFER_UNSUPPORTED",
        36061: "FRAMEBUFFER_INCOMPLETE_MULTISAMPLE"
      };
      console.error(`Framebuffer ${fbName} Error: ${statusMap[status] || "Unknown error"}`);
    } else {
      console.log(`Framebuffer ${fbName} is complete!`);
    }
  }

  initRenderbuffer(width, height) {
    this.renderbuffer = this.gl.createRenderbuffer();
    this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.renderbuffer);
    this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_COMPONENT16, width, height);
  }

  draw(conf = {progSlot: 0}) {
    console.log(`draw prog ${conf.progSlot}`);
    this.gl.bindVertexArray(this.buffers[conf.progSlot].vertsVAO); // repeat this on each draw()
    this.gl.drawElements(
        this.gl.TRIANGLES,
        this.buffers[conf.progSlot].indices_len,
        this.gl.UNSIGNED_SHORT,
        0
    );
  }

  drawToFB(conf = {
    fbId: "packing",
    progSlot: 0,
    w: this.packW,
    h: this.packH,
    debug: false
  }) {
    this.progs[conf.progSlot].useProgram();
    // Adjust viewport for packed size
    this.gl.viewport(0, 0, conf.w, conf.h);
    // Bind the framebuffer to render into texture 1
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffers[conf.fbId]);

    if (conf.debug) {
      this.checkFramebufferStatus(conf.fbId);
    }

    // don't forget to set attachment slot 1 in config if you want to debug coordinates
    let attachments = this.fbConfigs[conf.fbId].map(fb => this.gl.COLOR_ATTACHMENT0 + fb.attachmentSlot);
    this.gl.drawBuffers(attachments);
    this.draw(conf);
    if(conf.debug) {
      this.framebufferReads();
    }
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  processAndDraw(pixelData) {
    try{
      this.textures[0].update(pixelData);
    } catch (e) {
      console.error(e);
    }

    this.drawToFB({   // draws to tex 1 and 2
        fbId: "packing",
        progSlot: 0,
        w: this.packW,
        h: this.packH,
        debug: false
      });

    this.textures[1].activate();

    this.drawToFB({   // draws to tex 5
        fbId: "processing",
        progSlot: 4,
        w: this.packW,
        h: this.packH,
        debug: false
      });

    this.textures[5].activate();

    this.drawToFB({  // draws to tex 3
        fbId: "unpacking",
        progSlot: 1,
        w: this.w,
        h: this.h,
        debug: false
      });

    this.textures[3].activate();

    this.progs[3].useProgram(); // copies unpacked texture to canvas
    this.gl.viewport(0, 0, this.w, this.h);
    this.draw({progSlot: 3});

    let occlusionQuery = this.gl.createQuery();
    this.gl.beginQuery(this.gl.ANY_SAMPLES_PASSED_CONSERVATIVE, occlusionQuery);
    this.drawToFB({
        fbId: "occlusion",
        progSlot: 2,
        w: this.w,
        h: this.h,
        debug: false
      });
    this.gl.endQuery(this.gl.ANY_SAMPLES_PASSED_CONSERVATIVE);

    new Promise(resolve => {
      const checkResult = () => {
        if (this.gl.getQueryParameter(occlusionQuery, this.gl.QUERY_RESULT_AVAILABLE)) {
          const anyDifferent = this.gl.getQueryParameter(occlusionQuery, this.gl.QUERY_RESULT);
          resolve(anyDifferent);
        } else {
          setTimeout(checkResult, 5);
        }
      };
      setTimeout(checkResult, 5);
    }).then(different => {
      if (different) {
        console.log("Textures are different!");
      } else {
        console.log("Textures are identical!");
      }
    });

  }


  framebufferReads() {
    const readBuffer = new Uint8Array(this.packW * this.packH * 4);
    this.gl.readBuffer(this.gl.COLOR_ATTACHMENT0);
    this.gl.readPixels(
        0,
        0,
        this.packW,
        this.packH,
        this.gl.RGBA, this.gl.UNSIGNED_BYTE,
        readBuffer
    );
    const coordBuffer = new Float32Array(this.packW * this.packH * 4);
    this.gl.readBuffer(this.gl.COLOR_ATTACHMENT1);
    this.gl.readPixels(
      0,
      0,
      this.packW,
      this.packH,
      this.gl.RGBA, this.gl.FLOAT,
      coordBuffer
    );

    function printAs4x4Table(arr) {
      for (let i = 0; i < 16; i += 4) {
        console.log(
          arr[i].toString().padStart(3) + ' ' +
          arr[i+1].toString().padStart(3) + ' ' +
          arr[i+2].toString().padStart(3) + ' ' +
          arr[i+3].toString().padStart(3)
        );
      }
    }

    console.log("readBuffer", readBuffer);
    console.log("coordBuffer", coordBuffer);
    for(let i=0; i < readBuffer.length; i += 4) {
         console.log(
          (coordBuffer[i]-0.5).toString().padStart(3) + ', ' +
          (coordBuffer[i+1]-0.5).toString().padStart(3) + ' | ' +
          readBuffer[i].toString().padStart(3) + ', ' +
          readBuffer[i+1].toString().padStart(3) + ', ' +
          readBuffer[i+2].toString().padStart(3)
        );
    }
  }


  readPixelsRGB() {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
      const readBuffer = new Float32Array(this.w * this.h * 4);

      this.gl.readPixels(
          0,
          0,
          this.w,
          this.h,
          this.gl.RGBA,
          this.gl.FLOAT,
          readBuffer
      );
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

    const img = this.ctx_debug.getImageData(
        0,
        0,
        this.w,
        this.h
    );
    for (let i = 0, j = 0; i < img.data.length; i += 4, j += 4) {
        // data[i] = readBuffer[j] * 255;
        // data[i + 1] = readBuffer[j + 1] * 255;
        img.data[i + 2] = readBuffer[j + 2] * 255;
        img.data[i + 3] = 255;
    }
    this.ctx_debug.putImageData(img, 0, 0);
  }


  readPixelsDepth() {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
      const readBuffer = new Float32Array(this.w * this.h);
      this.gl.readPixels(
          0,
          0,
          this.w,
          this.h,
          this.gl.RED,
          this.gl.FLOAT,
          readBuffer
      );
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

      const img = this.ctx_debug.getImageData(
          0,
          0,
          this.w,
          this.h
      );
      for (let i = 0, j = 0; i < img.data.length; i += 4, j += 1) {
          img.data[i] = Math.min(readBuffer[j] * 255 * 10, 255);
          img.data[i + 3] = 255;
      }
      this.ctx_debug.putImageData(img, 0, 0);
  }

}

