import { ProcessingWEBGL} from "./utils.js";
import { sels, selRotateOrth, generateShaderCode } from "./thinning.js";

Window.ProcessingWEBGL = ProcessingWEBGL;

Window.sels = sels;
Window.selRotateOrth = selRotateOrth;
Window.generateShaderCode = generateShaderCode;
