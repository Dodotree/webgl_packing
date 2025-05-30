export const sels = {
  sel_4_1: [
      [0,0,1],
      [2,0,1],
      [0,0,1]
  ],
  sel_4_2: [
      [0,0,1],
      [2,0,1],
      [0,2,0]
  ],
  sel_4_3: [
      [0,2,0],
      [2,0,1],
      [0,0,1]
  ],
  sel_4_4: [
      [0,2,0],
      [2,0,1],
      [0,2,0]
  ],
  sel_4_5: [
      [0,2,1],
      [2,0,1],
      [0,2,0]
  ],
  sel_4_6: [
      [0,2,0],
      [2,0,1],
      [0,2,1]
  ],
  sel_4_7: [
      [0,1,1],
      [2,0,1],
      [0,2,0]
  ],
  sel_4_8: [
      [0,0,1],
      [2,0,1],
      [2,0,1]
  ],
  sel_4_9: [
      [2,0,1],
      [2,0,1],
      [0,0,1]
  ],
  sel_8_1: [
      [0,1,0],
      [2,0,1],
      [0,1,0]
  ],
  sel_8_2: [
      [0,1,0],
      [2,0,1],
      [2,0,0]
  ],
  sel_8_3: [
      [2,0,0],
      [2,0,1],
      [0,1,0]
  ],
  sel_8_4: [
      [2,0,0],
      [2,0,1],
      [2,0,0]
  ],
  sel_8_5: [
      [2,0,1],
      [2,0,1],
      [2,0,0]
  ],
  sel_8_6: [
      [2,0,0],
      [2,0,1],
      [2,0,1]
  ],
  sel_8_7: [
      [0,1,0],
      [2,0,1],
      [2,2,0]
  ],
  sel_8_8: [
      [0,1,0],
      [2,0,1],
      [2,1,0]
  ],
  sel_8_9: [
      [2,1,0],
      [2,0,1],
      [0,1,0]
  ],
  sel_48_1: [
      [0,1,1],
      [2,0,1],
      [2,2,0]
  ],
  sel_48_2: [
      [2,0,1],
      [2,0,1],
      [2,0,1]
  ]
}

const SEL_HIT = 1;
const SEL_MISS = 2;
const SEL_DONT_CARE = 0;

/**
 * Rotates a structuring element by multiples of 90 degrees clockwise
 * @param {Object} sel - The source structuring element
 * @param {number} quads - Number of 90 degree clockwise rotations (0-4)
 * @returns {Object} The rotated structuring element or null on error
 */
export function selRotateOrth(sel, quads) {
  if (!sel)
      return null;
  if (quads < 0 || quads > 4)
      throw new Error("quads not in {0,1,2,3,4}");
  if (quads === 0 || quads === 4)
      return sel;

  // Get parameters of the input sel
  // const { sy, sx, cy, cx } = selGetParameters(sel);
  // for our sels it's constant
  const sy = 3;
  const sx = 3;
  const nsy = 3;
  const nsx = 3;
  // cy = 1, cx = 1, ncx = 1, ncy = 1; // don't need center adjustments

  // const seld = selCreateBrick(nsy, nsx, ncy, ncx, SEL_DONT_CARE);
  const seld = Array.from({ length: nsy }, () => Array(nsx).fill(SEL_DONT_CARE));

  // Copy the elements with rotation
  for (let i = 0; i < sy; i++) {
      for (let j = 0; j < sx; j++) {
          let ni, nj;

          if (quads === 1) {
              ni = j;
              nj = sy - i - 1;
          } else if (quads === 2) {
              ni = sy - i - 1;
              nj = sx - j - 1;
          } else {  // quads === 3
              ni = sx - j - 1;
              nj = i;
          }

          seld[ni][nj] = sel[i][j];
      }
  }

  return seld;
}


/**
 * Generates GLSL shader code for SEL operations and their rotations
 * @param {string} selName - Name of the SEL pattern to use
 * @param {number} rotations - Number of rotations to show (default 4)
 * @return {string} GLSL shader code for the SEL pattern
 */
export function generateShaderCode(mySels, rotationQuad = 0) {
    const rotationNames = ["0°", "90°", "180°", "270°", "0°"];
    let code = "\n";
    let comment = `// rotation ${rotationNames[rotationQuad]}\n//`;
    let comms = ["\n//","\n//", "\n//"];

    mySels.forEach((selName, ind) => {

        // Get original SEL
        const sel = sels[selName];
        if (!sel) {
            return `// Error: SEL pattern "${selName}" not found`;
        }
        comment += ` ${selName}    `;

        // Generate rotated versions
        const rotation = selRotateOrth(sel, rotationQuad);
        for (let i = 0; i < 3; i++) {
            comms[i] += ` ${rotation[i].join(',')}      `;
        }

        // Map for position to sample name
        const sampleNames = {
            '-1,-1': 'above_left',
            '0,-1': 'above',
            '1,-1': 'above_right',
            '-1,0': 'left',
            '0,0': 'center',
            '1,0': 'right',
            '-1,1': 'below_left',
            '0,1': 'below',
            '1,1': 'below_right'
        };


        // Create the pattern visualization
        code += `\n// ${selName}  ${rotationNames[rotationQuad]} rotation:\n`;



        let cy = 1, cx = 1; // Center coordinates

        // Add rotated versions
        code += "bool ";
        let isFirst = true;
        for (let y = 0; y < rotation.length; y++) {
            for (let x = 0; x < rotation[0].length; x++) {
                const value = rotation[y][x];
                if (value === 0) continue;

                const dy = y - cy;
                const dx = x - cx;
                const posKey = `${dx},${dy}`;
                const sampleName = sampleNames[posKey] || `unknown_${dx}_${dy}`;

                code += `val${ind} = `;
                code += (isFirst)? '' : `val${ind} && `;
                isFirst = false;
                if (value === 1) { // Hit
                    code += `box[${3*y + x}];     // Hit at ${sampleName} (${dx}, ${dy})\n`;
                } else if (value === 2) { // Miss
                    code += `(!box[${3*y+x}]);     // Miss at ${sampleName} (${dx}, ${dy})\n`;
                }
            }
        }


    });

  return comment + comms.join('') + code;
}


