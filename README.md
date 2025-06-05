# WebGL Binary Image Packing

This repository demonstrates an efficient technique for processing binary (black and white) image data using WebGL. The core concept is packing 32 binary pixels into a single RGBA pixel, where each channel (R, G, B, A) stores 8 binary values as bits. This approach optimizes memory usage and processing speed, allowing for 32× data compression and potentially significant performance improvements when working with large binary image datasets. While binary data requires only 1 bit per pixel, modern computer architectures don't provide efficient mechanisms for directly accessing or processing individual bits in parallel. Memory systems and processors (including GPUs) are designed to work with aligned chunks of data—typically 8, 16, 32, or 64 bits at a time. By packing multiple binary values into standard 32-bit RGBA pixels, we align the data with the GPU's natural processing units, enabling efficient parallel operations on what would otherwise be scattered individual bits (using only 1 bit per row of 32 bits). For example, by retrieving only 9 texels you'll get 24x12 data block where you can perform 7x1 dilation just by spearfishing 7bits simultaneously from 24bit int and not iterating through 7bits and complicating your code with ifs.

The implementation uses WebGL 2.0 and GLSL shaders to perform both the packing and unpacking operations. During the packing phase, the fragment shader analyzes 8×4 blocks of binary pixels from the source image and encodes their values into bit patterns stored in RGBA channels. For unpacking, a separate shader decodes these values back into their original binary representation. Between these operations, the packed representation enables efficient binary operations (like AND, OR, XOR) directly in the shader, making complex pattern recognition or binary morphology operations much faster than traditional pixel-by-pixel processing.

This technique bridges the gap between binary image processing algorithms and GPU acceleration, providing significant benefits for applications like OCR, barcode/QR code scanning, document processing, and medical image analysis. These optimizations can be deployed across virtually any modern device without requiring specialized hardware or software installations.

## Project Status Disclaimer
⚠️ **PLEASE NOTE**: This project is currently in its earliest stage of development.

## Coming Up
- Detailed usage example
- Performance benchmarks

## License

[MIT License](LICENSE)


## Contributing

Contributions are welcome! If you're interested in contributing or have suggestions, please feel free to open an issue or submit a pull request. Your feedback is valuable as the project evolves!
