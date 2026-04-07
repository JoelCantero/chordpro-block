<?php
/**
 * Plugin Name:       ChordPro Block
 * Plugin URI:        https://github.com/JoelCantero/chordpro-block
 * Description:       A Gutenberg block for rendering songs in ChordPro notation. Chords appear above lyrics in the classic lead-sheet style.
 * Version:           1.0.0
 * Requires at least: 6.9
 * Requires PHP:      7.4
 * Author:            Joel Cantero
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       chordpro-block
 * Domain Path:       /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action(
	'plugins_loaded',
	function () {
		load_plugin_textdomain( 'chordpro-block', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
	}
);

add_action(
	'init',
	function () {
		register_block_type( __DIR__ . '/build' );

		if ( function_exists( 'wp_set_script_translations' ) ) {
			wp_set_script_translations(
				'chordpro-block-song-editor-script',
				'chordpro-block',
				plugin_dir_path( __FILE__ ) . 'languages'
			);

			wp_set_script_translations(
				'chordpro-block-song-view-script',
				'chordpro-block',
				plugin_dir_path( __FILE__ ) . 'languages'
			);
		}
	}
);
