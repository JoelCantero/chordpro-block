<?php
/**
 * Server-side render for the ChordPro block.
 *
 * Available variables:
 *   $attributes  (array)    — Block attributes.
 *   $content     (string)   — InnerBlocks content (unused here).
 *   $block       (WP_Block) — Block instance.
 */

if ( empty( $attributes['content'] ) ) {
	return;
}

require_once __DIR__ . '/parser.php';

$raw_content = $attributes['content'];
$storage_key = 'chordpro-block:' . md5( $raw_content );
$chord_color = '';

if ( ! empty( $attributes['chordColor'] ) ) {
	$chord_color = sanitize_hex_color( $attributes['chordColor'] );
} else {
	$primary = '';

	if ( function_exists( 'wp_get_global_settings' ) ) {
		$theme_json = wp_get_global_settings( array( 'color', 'palette' ) );

		if ( ! empty( $theme_json ) && is_array( $theme_json ) ) {
			foreach ( $theme_json as $color ) {
				if ( isset( $color['slug'] ) && 'primary' === $color['slug'] && ! empty( $color['color'] ) ) {
					$primary = $color['color'];
					break;
				}
			}
		}
	}

	if ( empty( $primary ) && function_exists( 'get_theme_support' ) ) {
		$palette = get_theme_support( 'editor-color-palette' );

		if ( ! empty( $palette[0] ) && is_array( $palette[0] ) ) {
			foreach ( $palette[0] as $color ) {
				if ( isset( $color['slug'] ) && 'primary' === $color['slug'] && ! empty( $color['color'] ) ) {
					$primary = $color['color'];
					break;
				}
			}
		}
	}

	$chord_color = $primary;
}

$show_title  = ! empty( $attributes['showTitle'] );
$show_artist = ! empty( $attributes['showArtist'] );
$font_family = ! empty( $attributes['fontFamily'] ) ? sanitize_text_field( $attributes['fontFamily'] ) : 'default';
$font_class  = '';

if ( 'roboto' === $font_family ) {
	$font_class = 'chordpro-font-roboto';
} elseif ( 'martian' === $font_family ) {
	$font_class = 'chordpro-font-martian';
}

$labels = array();

foreach ( \ChordProBlock\Parser\get_label_definitions() as $key => $definition ) {
	$labels[ $key ] = '_x' === ( $definition['function'] ?? '__' )
		? _x( $definition['text'], $definition['context'] ?? '', 'chordpro-block' )
		: __( $definition['text'], 'chordpro-block' );
}

$document     = \ChordProBlock\Parser\parse_chordpro_document( $raw_content );
$song_html    = \ChordProBlock\Parser\render_chordpro_document(
	$document,
	array(
		'showTitle'  => $show_title,
		'showArtist' => $show_artist,
		'labels'     => $labels,
	)
);
$schema_graph = \ChordProBlock\Parser\build_schema_graph( $document, $labels['songLyricsDefault'] );
$schema_json  = wp_json_encode( $schema_graph, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );

printf(
	'<div %1$s data-transpose-storage-key="%2$s"><div class="chordpro-song%6$s"%5$s>%3$s</div>%4$s</div>',
	get_block_wrapper_attributes(),
	esc_attr( $storage_key ),
	$song_html,
	$schema_json ? '<script type="application/ld+json">' . $schema_json . '</script>' : '',
	$chord_color ? ' style="--chordpro-chord-color:' . esc_attr( $chord_color ) . ';"' : '',
	$font_class ? ' ' . esc_attr( $font_class ) : ''
);
