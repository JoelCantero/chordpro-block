// No customisation needed — @wordpress/scripts default config handles everything.
// style.scss imported in index.js is extracted by the built-in splitChunks
// "style" cache group, producing build/style-index.css.
module.exports = require( '@wordpress/scripts/config/webpack.config' );
