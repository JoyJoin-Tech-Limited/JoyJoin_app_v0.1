var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { defineConfig } from '@tarojs/cli';
import devConfig from './dev';
import prodConfig from './prod';
var path = require('path');
// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig(function (merge) { return __awaiter(void 0, void 0, void 0, function () {
    var baseConfig;
    return __generator(this, function (_a) {
        baseConfig = {
            projectName: 'mini-program',
            date: '2026-3-4',
            designWidth: 750,
            deviceRatio: {
                640: 2.34 / 2,
                750: 1,
                375: 2,
                828: 1.81 / 2
            },
            sourceRoot: 'src',
            outputRoot: 'dist',
            plugins: [
                "@tarojs/plugin-generator"
            ],
            defineConstants: {},
            copy: {
                patterns: [
                    {
                        from: 'src/assets',
                        to: 'dist/assets',
                    },
                    // Taro Vite runner does not auto-compile custom-tab-bar.
                    // We ship it as a pre-built native WeChat component instead.
                    {
                        from: 'src/native-custom-tab-bar/',
                        to: 'dist/custom-tab-bar/',
                    },
                ],
                options: {}
            },
            framework: 'react',
            compiler: {
                type: 'vite',
                vitePlugins: []
            },
            alias: {
                '@': path.resolve(__dirname, '..', 'src'),
                '@shared': path.resolve(__dirname, '..', '..', '..', 'packages', 'shared', 'src'),
                '@tarojs/plugin-framework-react/dist/runtime': path.resolve(__dirname, '..', 'node_modules/@tarojs/plugin-framework-react/dist/runtime.js'),
            },
            sass: {
                resource: [
                    path.resolve(__dirname, '..', 'src/styles/_variables.scss'),
                    path.resolve(__dirname, '..', 'src/styles/_mixins.scss'),
                ],
            },
            mini: {
                imageUrlLoaderOption: {
                    limit: 100
                },
                compiler: {
                    type: 'vite',
                    vitePlugins: []
                },
                postcss: {
                    pxtransform: {
                        enable: true,
                        config: {}
                    },
                    cssModules: {
                        enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
                        config: {
                            namingPattern: 'module', // 转换模式，取值为 global/module
                            generateScopedName: '[name]__[local]___[hash:base64:5]'
                        }
                    }
                },
            },
            h5: {
                publicPath: '/',
                staticDirectory: 'static',
                miniCssExtractPluginOption: {
                    ignoreOrder: true,
                    filename: 'css/[name].[hash].css',
                    chunkFilename: 'css/[name].[chunkhash].css'
                },
                postcss: {
                    autoprefixer: {
                        enable: true,
                        config: {}
                    },
                    cssModules: {
                        enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
                        config: {
                            namingPattern: 'module', // 转换模式，取值为 global/module
                            generateScopedName: '[name]__[local]___[hash:base64:5]'
                        }
                    }
                },
            },
            rn: {
                appName: 'taroDemo',
                postcss: {
                    cssModules: {
                        enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
                    }
                }
            }
        };
        if (process.env.NODE_ENV === 'development') {
            // 本地开发构建配置（不混淆压缩）
            return [2 /*return*/, merge({}, baseConfig, devConfig)];
        }
        // 生产构建配置（默认开启压缩混淆等）
        return [2 /*return*/, merge({}, baseConfig, prodConfig)];
    });
}); });
