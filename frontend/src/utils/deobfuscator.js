/**
 * JavaScript Deobfuscator
 * Handles various types of JavaScript obfuscation similar to de4js
 */

/**
 * Detect obfuscation type
 */
export const detectObfuscationType = (code) => {
  if (!code || typeof code !== 'string') return 'none';

  // Limit check to first 10000 chars for performance
  const sample = code.length > 10000 ? code.substring(0, 10000) : code;

  // Check for eval-based packer
  if (/eval\s*\(\s*function\s*\(p,a,c,k,e,/.test(sample)) {
    return 'packer';
  }

  // Check for JSFuck (only uses []()!+ characters)
  if (/^\s*\[\]\(\)!+/.test(sample) && !/[a-zA-Z0-9]/.test(sample.substring(0, 100))) {
    return 'jsfuck';
  }

  // Check for JJencode/AAencode (uses special characters)
  if (/\$={[\s\S]*}\(\$\)/.test(sample) || /ﾟωﾟ/.test(sample)) {
    return 'jjencode';
  }

  // Check for array-based obfuscation (common pattern)
  if (/var\s+\w+\s*=\s*\[['"]/.test(sample) && /\w+\[\d+\]/.test(sample)) {
    return 'array';
  }

  // Check for obfuscator.io pattern
  if (/_0x[a-f0-9]+/.test(sample) && /function\s+_0x[a-f0-9]+\(\)/.test(sample)) {
    return 'obfuscator.io';
  }

  return 'unknown';
};

/**
 * Unpacker for Dean Edwards' Packer
 */
const unpackPacker = (code) => {
  try {
    const packerRegex = /eval\s*\(\s*function\s*\(p,a,c,k,e,d\)\s*{[^}]*}\s*\((.*)\)\s*\)/;
    const match = code.match(packerRegex);

    if (!match) return code;

    // Extract the packed data
    const args = match[1].split(',');
    if (args.length < 4) return code;

    // Parse the arguments
    const p = args[0].trim().replace(/^['"]|['"]$/g, '');
    const a = parseInt(args[1]);
    const c = parseInt(args[2]);
    const k = args[3].trim();

    // Evaluate the dictionary
    let dict;
    try {
      dict = eval(k);
    } catch (e) {
      return code;
    }

    if (!Array.isArray(dict)) return code;

    // Decode function
    const decode = (p, a, c, k) => {
      while (c--) {
        if (k[c]) {
          const regex = new RegExp('\\b' + c.toString(a) + '\\b', 'g');
          p = p.replace(regex, k[c]);
        }
      }
      return p;
    };

    return decode(p, a, c, dict);
  } catch (e) {
    console.error('Unpacker error:', e);
    return code;
  }
};

/**
 * Deobfuscate array-based obfuscation (improved)
 */
const deobfuscateArray = (code) => {
  try {
    let arrays = {};
    let result = code;

    // Pattern 1: Simple array declarations: var _0x1234 = ['str1', 'str2'];
    const simpleArrayPattern = /var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([^\]]+)\];/g;
    let match;

    while ((match = simpleArrayPattern.exec(code)) !== null) {
      const varName = match[1];
      const arrayContent = match[2];

      try {
        const arr = eval('[' + arrayContent + ']');
        if (Array.isArray(arr) && arr.length > 0) {
          arrays[varName] = arr;
          console.log(`Found array: ${varName} with ${arr.length} items`);
        }
      } catch (e) {
        // Skip invalid arrays
      }
    }

    // Replace array accesses with values
    for (const [varName, arr] of Object.entries(arrays)) {
      // Hex indices: array[0x5]
      const hexPattern = new RegExp(varName + '\\[0x([a-f0-9]+)\\]', 'gi');
      result = result.replace(hexPattern, (match, hex) => {
        const idx = parseInt(hex, 16);
        if (idx < arr.length) {
          const val = arr[idx];
          if (typeof val === 'string') {
            return JSON.stringify(val);
          } else if (typeof val === 'number') {
            return String(val);
          }
        }
        return match;
      });

      // Decimal indices: array[5]
      const decPattern = new RegExp(varName + '\\[([0-9]+)\\]', 'g');
      result = result.replace(decPattern, (match, num) => {
        const idx = parseInt(num);
        if (idx < arr.length) {
          const val = arr[idx];
          if (typeof val === 'string') {
            return JSON.stringify(val);
          } else if (typeof val === 'number') {
            return String(val);
          }
        }
        return match;
      });
    }

    return result;
  } catch (e) {
    console.error('Array deobfuscation error:', e);
    return code;
  }
};

/**
 * Deobfuscate obfuscator.io style code (improved version)
 */
const deobfuscateObfuscatorIO = (code) => {
  try {
    let result = code;
    let stringArrays = {};
    let functionAliases = {};

    // Pattern 1: Find array initialization functions like:
    // function a29_0x5e39(){var _0x10ef10=['str1','str2',...];return _0x10ef10;}
    const arrayFnPattern = /function\s+([a-zA-Z0-9_$]+)\s*\(\)\s*{\s*var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([^\]]+)\];\s*return\s+\2;\s*}/g;
    let arrayMatch;

    while ((arrayMatch = arrayFnPattern.exec(code)) !== null) {
      const fnName = arrayMatch[1];
      const arrName = arrayMatch[2];
      const arrContent = arrayMatch[3];

      try {
        // Evaluate the array
        const arr = eval('[' + arrContent + ']');
        if (Array.isArray(arr)) {
          stringArrays[fnName] = arr;
          console.log(`Found string array function: ${fnName} with ${arr.length} strings`);
        }
      } catch (e) {
        console.warn(`Failed to evaluate array for ${fnName}:`, e);
      }
    }

    // Pattern 2: Find variable assignments like: var a29_0x1d3d1c=a29_0x59d1;
    const aliasPattern = /var\s+([a-zA-Z0-9_$]+)\s*=\s*([a-zA-Z0-9_$]+);/g;
    let aliasMatch;

    while ((aliasMatch = aliasPattern.exec(code)) !== null) {
      const alias = aliasMatch[1];
      const target = aliasMatch[2];

      // Check if target is a known string array function
      if (stringArrays[target]) {
        functionAliases[alias] = target;
        console.log(`Found alias: ${alias} -> ${target}`);
      }
    }

    // Replace all function calls with their string values
    for (const [fnName, arr] of Object.entries(stringArrays)) {
      // Get all aliases for this function
      const allNames = [fnName, ...Object.keys(functionAliases).filter(k => functionAliases[k] === fnName)];

      for (const name of allNames) {
        // Pattern: functionName(0x123) or functionName(123)
        const hexPattern = new RegExp(name + '\\s*\\(\\s*0x([a-f0-9]+)\\s*\\)', 'gi');
        result = result.replace(hexPattern, (match, hex) => {
          const idx = parseInt(hex, 16);
          if (idx < arr.length) {
            return JSON.stringify(arr[idx]);
          }
          return match;
        });

        const decPattern = new RegExp(name + '\\s*\\(\\s*([0-9]+)\\s*\\)', 'g');
        result = result.replace(decPattern, (match, num) => {
          const idx = parseInt(num);
          if (idx < arr.length) {
            return JSON.stringify(arr[idx]);
          }
          return match;
        });
      }
    }

    // Pattern 3: Direct array access like _0x10ef10[0x5]
    for (const [fnName, arr] of Object.entries(stringArrays)) {
      // Look for the array variable name inside the function
      const varPattern = new RegExp(`function\\s+${fnName}\\s*\\(\\)\\s*{\\s*var\\s+([a-zA-Z0-9_$]+)`);
      const varMatch = code.match(varPattern);

      if (varMatch) {
        const varName = varMatch[1];

        // Replace array[index] with values
        const accessPattern = new RegExp(varName + '\\[0x([a-f0-9]+)\\]', 'gi');
        result = result.replace(accessPattern, (match, hex) => {
          const idx = parseInt(hex, 16);
          if (idx < arr.length) {
            return JSON.stringify(arr[idx]);
          }
          return match;
        });

        const accessPattern2 = new RegExp(varName + '\\[([0-9]+)\\]', 'g');
        result = result.replace(accessPattern2, (match, num) => {
          const idx = parseInt(num);
          if (idx < arr.length) {
            return JSON.stringify(arr[idx]);
          }
          return match;
        });
      }
    }

    // Fallback: Try general array-based deobfuscation
    if (result === code) {
      result = deobfuscateArray(result);
    }

    return result;
  } catch (e) {
    console.error('Obfuscator.io deobfuscation error:', e);
    return code;
  }
};

/**
 * URL decode
 */
const urlDecode = (code) => {
  try {
    if (code.includes('%')) {
      return decodeURIComponent(code);
    }
    return code;
  } catch (e) {
    return code;
  }
};

/**
 * Unescape string literals
 */
const unescapeStrings = (code) => {
  try {
    // Unescape unicode sequences
    let result = code.replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    // Unescape hex sequences
    result = result.replace(/\\x([0-9a-fA-F]{2})/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    return result;
  } catch (e) {
    return code;
  }
};

/**
 * Remove redundant groupings and simplify
 */
const simplifyCode = (code) => {
  try {
    let result = code;

    // Remove unnecessary parentheses around single values
    result = result.replace(/\((['"][\s\S]*?['"])\)/g, '$1');

    // Simplify concatenation
    result = result.replace(/(['"])(.*?)\1\s*\+\s*(['"])(.*?)\3/g, (match, q1, s1, q2, s2) => {
      if (q1 === q2) {
        return q1 + s1 + s2 + q1;
      }
      return match;
    });

    return result;
  } catch (e) {
    return code;
  }
};

/**
 * Main deobfuscation function
 * Attempts multiple deobfuscation techniques
 */
export const deobfuscate = (code, options = {}) => {
  if (!code || typeof code !== 'string') return code;

  const startTime = Date.now();
  const originalLength = code.length;

  // Skip deobfuscation for very large files (>10MB) to prevent performance issues
  if (code.length > 10 * 1024 * 1024) {
    console.warn('%c[Deobfuscator] ⚠ File too large for deobfuscation (>10MB), skipping', 'color: #ff6600; font-weight: bold');
    console.log(`File size: ${(code.length / 1024 / 1024).toFixed(2)} MB`);
    return code;
  }

  const {
    detectType = true,
    maxIterations = 3
  } = options;

  let result = code;
  let previousResult = '';
  let iterations = 0;

  // Detect obfuscation type if requested
  const type = detectType ? detectObfuscationType(code) : 'unknown';
  console.log(`%c[Deobfuscator] Detected type: ${type}`, 'color: #00ff00; font-weight: bold');
  console.log(`%c[Deobfuscator] File size: ${(originalLength / 1024).toFixed(2)} KB`, 'color: #00aaff');

  // Apply deobfuscation techniques iteratively
  while (result !== previousResult && iterations < maxIterations) {
    previousResult = result;
    iterations++;
    console.log(`%c[Deobfuscator] Iteration ${iterations}/${maxIterations}`, 'color: #ffaa00');

    const iterStartLength = result.length;

    // URL decode
    result = urlDecode(result);

    // Unescape strings
    result = unescapeStrings(result);

    // Type-specific deobfuscation
    switch (type) {
      case 'packer':
        console.log('[Deobfuscator] Applying packer unpacking...');
        result = unpackPacker(result);
        break;
      case 'array':
        console.log('[Deobfuscator] Applying array deobfuscation...');
        result = deobfuscateArray(result);
        break;
      case 'obfuscator.io':
        console.log('[Deobfuscator] Applying obfuscator.io deobfuscation...');
        result = deobfuscateObfuscatorIO(result);
        break;
      default:
        // Try all techniques for unknown types
        console.log('[Deobfuscator] Trying all deobfuscation techniques...');
        result = unpackPacker(result);
        result = deobfuscateObfuscatorIO(result);
        result = deobfuscateArray(result);
    }

    // Simplify code
    result = simplifyCode(result);

    const changePercent = ((iterStartLength - result.length) / iterStartLength * 100).toFixed(2);
    console.log(`[Deobfuscator] Size change: ${changePercent}% (${iterStartLength} -> ${result.length} bytes)`);
  }

  const elapsed = Date.now() - startTime;
  const finalSizeChange = ((originalLength - result.length) / originalLength * 100).toFixed(2);

  console.log(`%c[Deobfuscator] ✓ Complete!`, 'color: #00ff00; font-weight: bold; font-size: 14px');
  console.log(`  • Iterations: ${iterations}`);
  console.log(`  • Time: ${elapsed}ms`);
  console.log(`  • Size change: ${finalSizeChange}%`);
  console.log(`  • Original: ${(originalLength / 1024).toFixed(2)} KB → Final: ${(result.length / 1024).toFixed(2)} KB`);

  return result;
};

/**
 * Full deobfuscation + beautification pipeline
 */
export const deobfuscateAndBeautify = (code, beautifyFn) => {
  if (!code || typeof code !== 'string') return code;

  // First deobfuscate
  let result = deobfuscate(code);

  // Then beautify
  if (beautifyFn && typeof beautifyFn === 'function') {
    result = beautifyFn(result);
  }

  return result;
};
