class PIX {
    constructor(width, height, depth) {
        this.width = width;
        this.height = height;
        this.depth = depth;

        if (depth === 1) {
            // Binary image: 1 bit per pixel
            this.data = new Uint8Array(Math.ceil(width * height / 8));
        } else if (depth === 8) {
            // Grayscale: 8 bits per pixel
            this.data = new Uint8Array(width * height);
        } else if (depth === 16) {
            // 16-bit data (for maps)
            this.data = new Uint16Array(width * height);
        } else if (depth === 32) {
            // RGBA: 32 bits per pixel
            this.data = new Uint8Array(width * height * 4);
        }

        this.xres = 0;
        this.yres = 0;
    }

    clone() {
        const pix = new PIX(this.width, this.height, this.depth);
        pix.data.set(this.data);
        pix.xres = this.xres;
        pix.yres = this.yres;
        return pix;
    }

    getPixel(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;

        if (this.depth === 1) {
            const byteIndex = Math.floor((y * this.width + x) / 8);
            const bitIndex = 7 - ((y * this.width + x) % 8);
            return (this.data[byteIndex] & (1 << bitIndex)) ? 1 : 0;
        } else {
            return this.data[y * this.width + x];
        }
    }

    setPixel(x, y, value) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

        if (this.depth === 1) {
            const byteIndex = Math.floor((y * this.width + x) / 8);
            const bitIndex = 7 - ((y * this.width + x) % 8);
            if (value)
                this.data[byteIndex] |= (1 << bitIndex);
            else
                this.data[byteIndex] &= ~(1 << bitIndex);
        } else {
            this.data[y * this.width + x] = value;
        }
    }

    getRGBPixel(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height || this.depth !== 32) return [0, 0, 0];

        const idx = (y * this.width + x) * 4;
        return [this.data[idx], this.data[idx+1], this.data[idx+2]];
    }

    setRGBPixel(x, y, r, g, b) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height || this.depth !== 32) return;

        const idx = (y * this.width + x) * 4;
        this.data[idx] = r;
        this.data[idx+1] = g;
        this.data[idx+2] = b;
        this.data[idx+3] = 255; // Alpha
    }
}


/**
 * Apply a sequence of morphological operations
 * Simple cross-shaped dilation (pixs, "d7.1 + d1.7")
 * meaning dilate with a 7x1 horizontal and 1x7 vertical cross
 */
function pixMorphSequence(pixs, sequence) {
    if (!pixs || pixs.depth !== 1) return null;

    const w = pixs.width;
    const h = pixs.height;
    const pixd = new PIX(w, h, 1);

    for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
            let isOne = false;

            // Check 7x1 horizontal neighborhood
            for (let dx = -3; dx <= 3; dx++) {
                if (j + dx >= 0 && j + dx < w && pixs.getPixel(j + dx, i) === 1) {
                    isOne = true;
                    break;
                }
            }

            // Check 1x7 vertical neighborhood
            if (!isOne) {
                for (let dy = -3; dy <= 3; dy++) {
                    if (i + dy >= 0 && i + dy < h && pixs.getPixel(j, i + dy) === 1) {
                        isOne = true;
                        break;
                    }
                }
            }

            pixd.setPixel(j, i, isOne ? 1 : 0);
        }
    }

    return pixd;
}


/**
 * Converts an 8 bpp grayscale image to binary using a threshold
 */
function pixThresholdToBinary(pixs, thresh) {
    if (!pixs || pixs.depth !== 8) return null;

    const w = pixs.width;
    const h = pixs.height;
    const pixd = new PIX(w, h, 1);

    for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
            const val = pixs.getPixel(j, i);
            pixd.setPixel(j, i, val < thresh ? 1 : 0); // < 60 is foreground -> 1, so 255 -> 0 background
        }
    }

    return pixd;
}


/**
 * Normalizes the image intensity by mapping so the background is near bgval
 */
function pixBackgroundNormSimple(pixs, pixim, pixg) {
    // Default parameters
/**
 *      The dimensions of the pixel tile (%sx, %sy) give the amount
*       by which the map is reduced in size from the input image. */
    const sx = 10;         // Tile width, > 3
    const sy = 15;         // Tile height, > 3
/**
 *        The input image is binarized using %thresh, in order to
 *        locate the foreground components.  If this is set too low,
 *        some actual foreground may be used to determine the maps;
 *        if set too high, there may not be enough background
 *        to determine the map values accurately.  Typically, it is
 *        better to err by setting the threshold too high. */
    const thresh = 60;     // Threshold for determining foreground
/**
 *        A %mincount threshold is a minimum count of pixels in a
 *        tile for which a background reading is made, in order for that
 *        pixel in the map to be valid.  This number should perhaps be
 *        at least 1/3 the size of the tile. */
          // will be set to Math.floor(sx * sy / 3); if bigger than that
    const mincount = 40;   // Minimum threshold on counts in a tile
/**
 *        A %bgval target background value for the normalized image.  This
 *        should be at least 128.  If set too close to 255, some
 *        clipping will occur in the result.  It is recommended to use
 *        %bgval = 200. */
    const bgval = 200;     // Target background value, typ. > 128 < 240
/**
 *         Two factors, %smoothx and %smoothy, are input for smoothing
 *         the map.  Each low-pass filter kernel dimension is
 *         is 2 * (smoothing factor) + 1, so a
 *         value of 0 means no smoothing. A value of 1 or 2 is recommended.
 */
    const smoothx = 2;     // Horizontal smoothing, half-width of block convolution kernel width
    const smoothy = 1;     // Vertical smoothing, half-width of block convolution kernel height

    return pixBackgroundNorm(
        pixs, null, null,
        sx, sy,
        thresh, mincount,
        bgval,
        smoothx, smoothy);
}


function pixBackgroundNorm(
    pixs, pixim, pixg,
    sx, sy,
    thresh, mincount,
    bgval,
    smoothx, smoothy) {

    if (!pixs) return null;

    const d = pixs.depth;
    if (d !== 8 && d !== 32)
        return null;

    if (sx < 4 || sy < 4)
        return null;

    if (mincount > sx * sy) {
        mincount = Math.floor(sx * sy / 3);
    }

    // Check if mask exists and is not all foreground
    let allfg = false;

    let pixd = null;

    if (d === 8) {
        // Process grayscale image
        const pixm = pixGetBackgroundGrayMap(pixs, null, sx, sy, thresh, mincount);
        if (!pixm) return null;

        const pixmi = pixGetInvBackgroundMap(pixm, bgval, smoothx, smoothy);
        if (!pixmi) return null;

        pixd = pixApplyInvBackgroundGrayMap(pixs, pixmi, sy);
    } else {
        // Process RGB image
        const { pixmr, pixmg, pixmb } = pixGetBackgroundRGBMap(pixs, null, null,
                                                           sx, sy, thresh, mincount);
        if (!pixmr || !pixmg || !pixmb) return null;

        const pixmri = pixGetInvBackgroundMap(pixmr, bgval, smoothx, smoothy);
        const pixmgi = pixGetInvBackgroundMap(pixmg, bgval, smoothx, smoothy);
        const pixmbi = pixGetInvBackgroundMap(pixmb, bgval, smoothx, smoothy);

        pixd = pixApplyInvBackgroundRGBMap(pixs, pixmri, pixmgi, pixmbi, sy);
    }

    // Copy resolution properties
    if (pixd) {
        pixd.xres = pixs.xres;
        pixd.yres = pixs.yres;
    }

    return pixd;
}


/**
 * Gets a background map for a grayscale image
 */
function pixGetBackgroundGrayMap(pixs, pixim, sx, sy, thresh, mincount) {
    if (!pixs || pixs.depth !== 8) return null;

    /* Generate the foreground mask, pixf, which is at full resolution.
    * mask has a value 0 for pixels in pixs that are likely to be
    * in the background, which is the condition for including
    * those source pixels when taking an average of the background
    * values for each tile.  */
    // Create binary version of input image and dilate
    const pixb = pixThresholdToBinary(pixs, thresh);
    const pixf = pixMorphSequence(pixb, "d7.1 + d1.7", 0); // hardcoded 7x1

    // Create output map
    /* ------------- Set up the output map pixd --------------- */
    /* In pixd, each 8 bit pixel represents a tile of size (sx, sy)
    * in pixs.  Each pixel in pixd will be filled with the average
    * background value of that tile in pixs.  */
    const w = pixs.width;
    const h = pixs.height;
    const wd = Math.ceil(w / sx);
    const hd = Math.ceil(h / sy);
    const pixd = new PIX(wd, hd, 8);
    /* Here we only compute map values in pixd for tiles that
    * are complete.  In general, the extreme right and bottom
    * tiles in pixs, which correspond to the rightmost column
    * and bottom row of pixd, are not complete.  These will
    * be filled in later.
    *
    * Use the full resolution mask pixf to decide which pixels
    * are used in each tile to estimate the background value.
    * After this operation, pixels in the background map pixd
    * that have not been set must be filled using adjacent pixels. */
    const nx = Math.floor(w / sx);
    const ny = Math.floor(h / sy);

    // Process each tile
    for (let i = 0; i < ny; i++) {
        for (let j = 0; j < nx; j++) {
            let count = 0;
            let sum = 0;

            // Analyze pixels in the tile
            for (let k = 0; k < sy; k++) {
                const y = i * sy + k;
                for (let m = 0; m < sx; m++) {
                    const x = j * sx + m;

                    // Skip foreground pixels
                    if (pixf.getPixel(x, y) === 1) continue;

                    sum += pixs.getPixel(x, y);
                    count++;
                }
            }

            // If enough pixels, compute average
            if (count >= mincount) {
                const val = Math.floor(sum / count);
                pixd.setPixel(j, i, val);
            }
        }
    }

    // Fill holes and handle mask regions
    /* Fill all the holes in the map.
    * Note that (nx,ny) represent the numbers of complete tiles
    * in the x and y directions of pixs, whereas the dimensions
    * of pixd are usually larger by 1. */
    pixFillMapHoles(pixd, nx, ny, 0); // 0 = L_FILL_BLACK

    return pixd;
}


/**
 * Get inverted background map
 */
function pixGetInvBackgroundMap(pixs, bgval, smoothx, smoothy) {
    if (!pixs || pixs.depth !== 8) return null;

    const w = pixs.width;  // map width
    const h = pixs.height; // map height
    const pixd = new PIX(w, h, 16);

    // Generate the inverse map
    for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
            const val = pixs.getPixel(j, i);
            // Convert to 16 bit inverse map, 65535 is the max for 16-bit
            const val16 = (val === 0) ? 65535 : Math.floor((65535 * bgval) / val);
            // max * (200/val)  , 60 <= val <= 255
            pixd.data[i * w + j] = val16;
        }
    }

    return pixd;
}


/**
 * Fill holes in a background map
 */
function pixFillMapHoles(pix, nx, ny, filltype) {
    if (!pix || pix.depth !== 8) return 1;

    const w = pix.width;
    const h = pix.height;
    const valtest = (filltype === 1) ? 255 : 0; // 0

    // Create array to track columns with data
    const hasData = new Array(w).fill(false);
    let emptyCount = 0;

    // Check which columns have data
    for (let x = 0; x < nx; x++) {
        let found = false;
        for (let y = 0; y < ny; y++) {
            if (pix.getPixel(x, y) !== valtest) {
                found = true;
                break;
            }
        }

        hasData[x] = found;
        if (!found) emptyCount++;
    }

    // If no columns have data, return error
    if (emptyCount === nx) return 1;

    // Fill missing columns
    if (emptyCount > 0) {
        // Find first good column
        let firstGood = 0;
        while (firstGood < nx && !hasData[firstGood]) {
            firstGood++;
        }

        // Fill columns before first good one
        for (let x = 0; x < firstGood; x++) {
            for (let y = 0; y < h; y++) {
                pix.setPixel(x, y, pix.getPixel(firstGood, y));
            }
        }

        // Fill other missing columns
        let lastGood = firstGood;
        for (let x = firstGood + 1; x < nx; x++) {
            if (hasData[x]) {
                lastGood = x;
            } else {
                for (let y = 0; y < h; y++) {
                    pix.setPixel(x, y, pix.getPixel(lastGood, y));
                }
            }
        }
    }

    // Fill columns beyond nx if needed
    if (w > nx) {
        for (let x = nx; x < w; x++) {
            for (let y = 0; y < h; y++) {
                pix.setPixel(x, y, pix.getPixel(nx - 1, y));
            }
        }
    }

    return 0;
}


/**
 * Gets background RGB maps for a color image
 */
function pixGetBackgroundRGBMap(pixs, pixim, pixg, sx, sy, thresh, mincount) {
    if (!pixs || pixs.depth !== 32) return null;

    // Use provided grayscale image or convert from RGB
    const pixgc = pixg ? pixg.clone() : pixConvertRGBToGrayFast(pixs);

    // Create binary version and dilate
    const pixb = pixThresholdToBinary(pixgc, thresh);
    const pixf = pixMorphSequence(pixb, "d7.1 + d1.7", 0);

    // Create output maps
    const w = pixs.width;
    const h = pixs.height;
    const wm = Math.ceil(w / sx);
    const hm = Math.ceil(h / sy);

    const pixmr = new PIX(wm, hm, 8);
    const pixmg = new PIX(wm, hm, 8);
    const pixmb = new PIX(wm, hm, 8);

    const nx = Math.floor(w / sx);
    const ny = Math.floor(h / sy);

    // Process each tile
    for (let i = 0; i < ny; i++) {
        for (let j = 0; j < nx; j++) {
            let count = 0;
            let rsum = 0, gsum = 0, bsum = 0;

            for (let k = 0; k < sy; k++) {
                const y = i * sy + k;
                for (let m = 0; m < sx; m++) {
                    const x = j * sx + m;

                    // Skip foreground pixels
                    if (pixf.getPixel(x, y) === 1) continue;

                    // Get RGB components
                    const [r, g, b] = pixs.getRGBPixel(x, y);

                    rsum += r;
                    gsum += g;
                    bsum += b;
                    count++;
                }
            }

            // If enough pixels, compute averages
            if (count >= mincount) {
                pixmr.setPixel(j, i, Math.floor(rsum / count));
                pixmg.setPixel(j, i, Math.floor(gsum / count));
                pixmb.setPixel(j, i, Math.floor(bsum / count));
            }
        }
    }

    // Fill holes
    pixFillMapHoles(pixmr, nx, ny, 0);
    pixFillMapHoles(pixmg, nx, ny, 0);
    pixFillMapHoles(pixmb, nx, ny, 0);

    return { pixmr, pixmg, pixmb };
}


