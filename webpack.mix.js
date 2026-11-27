const mix = require('laravel-mix');
const { VueLoaderPlugin } = require('vue-loader');

/*
 |--------------------------------------------------------------------------
 | Mix Asset Management
 |--------------------------------------------------------------------------
 |
 | Mix provides a clean, fluent API for defining some Webpack build steps
 | for your Laravel application. By default, we are compiling the Sass
 | file for the application as well as bundling up all the JS files.
 |
 | Vue 2.7 single file components are compiled with vue-loader 15, which
 | uses the compiler bundled with Vue 2.7 (vue/compiler-sfc). This is set
 | up directly instead of via mix.vue() so the deprecated and vulnerable
 | vue-template-compiler package is not required.
 |
 */

mix.js('resources/js/app.js', 'public/js')
   .sass('resources/sass/app.scss', 'public/css', {
       sassOptions: { quietDeps: true },
   })
   .override((config) => {
       // The .vue rule must come before Mix's html-loader rule, otherwise
       // VueLoaderPlugin picks up the /\.html$/ rule (it also probes *.vue.html).
       config.module.rules.unshift({ test: /\.vue$/, use: [{ loader: 'vue-loader' }] });
       config.plugins.push(new VueLoaderPlugin());
       config.resolve.extensions.push('.vue');
       // Full build (runtime + template compiler) so the in-DOM templates in
       // the Blade views keep working, and CommonJS so `window.Vue = require('vue')` works as it did with Mix 5.
       config.resolve.alias = { ...config.resolve.alias, vue$: 'vue/dist/vue.common.js' };
   });
