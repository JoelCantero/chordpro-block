<?php
/**
 * Pure ChordPro parser and renderer helpers.
 *
 * These functions intentionally avoid WordPress dependencies so they can be
 * reused in tests and from the block render callback.
 */

namespace ChordProBlock\Parser;

require_once __DIR__ . '/generated/chordpro-spec.php';

function get_spec() : array {
	return get_chordpro_shared_spec();
}

function get_label_definitions() : array {
	return get_spec()['labels'] ?? array();
}

function get_node_types() : array {
	return get_spec()['document']['nodeTypes'] ?? array();
}

function get_top_matter_item( string $key ) : ?array {
	$items = get_spec()['topMatter']['items'] ?? array();

	return $items[ $key ] ?? null;
}

function get_directive_node_config( string $key ) : ?array {
	$config = get_spec()['directiveNodes'] ?? array();

	return $config[ $key ] ?? null;
}

function get_directive_render_config( string $key ) : ?array {
	$config = get_spec()['render']['directiveNodes'] ?? array();

	return $config[ $key ] ?? null;
}

function compile_preg_pattern( string $source, string $flags = '' ) : string {
	return '/' . str_replace( '/', '\/', $source ) . '/' . $flags;
}

function get_structural_directive_pattern() : string {
	static $pattern = null;

	if ( null !== $pattern ) {
		return $pattern;
	}

	$spec         = get_spec();
	$structural   = $spec['structuralDirectives'] ?? array();
	$section_keys = array_keys( $structural['sectionStarts'] ?? array() );
	$section_ends = $structural['sectionEnds'] ?? array();
	$tab_starts   = $structural['tabs']['starts'] ?? array();
	$tab_ends     = $structural['tabs']['ends'] ?? array();
	$keys         = array_values(
		array_unique(
			array_merge(
				$section_keys,
				$section_ends,
				$tab_starts,
				$tab_ends
			)
		)
	);

	usort(
		$keys,
		static function ( string $first, string $second ) : int {
			return strlen( $second ) <=> strlen( $first );
		}
	);

	$pattern = '/^[{\[]\s*((' . implode(
		'|',
		array_map(
			static function ( string $value ) : string {
				return preg_quote( $value, '/' );
			},
			$keys
		)
	) . ')(?:\s*:\s*[^}\]]*)?)\s*[}\]]$/i';

	return $pattern;
}

function get_directive_line_pattern() : string {
	static $pattern = null;

	if ( null !== $pattern ) {
		return $pattern;
	}

	$pattern = compile_preg_pattern(
		get_spec()['patterns']['directiveLine'] ?? '^\\{([^}]+)\\}$',
		'u'
	);

	return $pattern;
}

function get_chord_token_pattern() : string {
	static $pattern = null;

	if ( null !== $pattern ) {
		return $pattern;
	}

	$pattern = compile_preg_pattern(
		get_spec()['patterns']['chordToken'] ?? '\\[[^\\]]+\\]',
		'u'
	);

	return $pattern;
}

function get_section_label_prefix_pattern() : string {
	static $pattern = null;

	if ( null !== $pattern ) {
		return $pattern;
	}

	$variants = get_spec()['render']['sectionLabelVariants'] ?? array();

	usort(
		$variants,
		static function ( string $first, string $second ) : int {
			return strlen( $second ) <=> strlen( $first );
		}
	);

	$pattern = '/^(' . implode(
		'|',
		array_map(
			static function ( string $value ) : string {
				return preg_quote( $value, '/' );
			},
			$variants
		)
	) . ')(\b.*)$/i';

	return $pattern;
}

function default_labels() : array {
	$labels = array();

	foreach ( get_label_definitions() as $key => $definition ) {
		$labels[ $key ] = $definition['text'];
	}

	return $labels;
}

function get_labels( array $overrides = array() ) : array {
	return array_merge( default_labels(), $overrides );
}

function escape_html( string $value ) : string {
	return htmlspecialchars( $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' );
}

function string_length( string $value ) : int {
	if ( function_exists( 'mb_strlen' ) ) {
		return mb_strlen( $value );
	}

	preg_match_all( '/./us', $value, $matches );

	return count( $matches[0] );
}

function get_directive_parts( string $raw ) : array {
	$trimmed   = trim( $raw );
	$colon_pos = strpos( $trimmed, ':' );

	if ( false !== $colon_pos ) {
		return array(
			'key'   => strtolower( trim( substr( $trimmed, 0, $colon_pos ) ) ),
			'value' => trim( substr( $trimmed, $colon_pos + 1 ) ),
		);
	}

	return array(
		'key'   => strtolower( $trimmed ),
		'value' => '',
	);
}

function extract_structural_directive( string $line ) : ?string {
	$trimmed = trim( $line );

	if ( ! preg_match( get_structural_directive_pattern(), $trimmed, $matches ) ) {
		return null;
	}

	return trim( $matches[1] );
}

function normalize_top_matter_key( string $key ) : string {
	return get_top_matter_item( $key )['canonicalKey'] ?? $key;
}

function is_top_matter_directive_key( string $key ) : bool {
	return null !== get_top_matter_item( $key );
}

function is_meta_row_directive_key( string $key ) : bool {
	return 'meta_row' === ( get_top_matter_item( $key )['group'] ?? null );
}

function get_top_matter_priority( string $key ) : int {
	return get_top_matter_item( $key )['priority'] ?? 100;
}

function has_chord_tokens( string $line ) : bool {
	return 1 === preg_match( get_chord_token_pattern(), $line );
}

function normalize_whitespace( string $value ) : string {
	return trim( preg_replace( '/\s+/u', ' ', $value ) ?? '' );
}

function build_accessible_chord_line( string $leading_text, array $segments ) : string {
	$parts                   = array();
	$normalized_leading_text = normalize_whitespace( $leading_text );

	if ( '' !== $normalized_leading_text ) {
		$parts[] = $normalized_leading_text;
	}

	foreach ( $segments as $segment ) {
		$segment_text = normalize_whitespace( $segment['chord'] . ' ' . $segment['lyric'] );

		if ( '' !== $segment_text ) {
			$parts[] = $segment_text;
		}
	}

	return trim( implode( ' ', $parts ) );
}

function is_transposable_chord( string $chord ) : bool {
	$trimmed = trim( $chord );

	return '' !== $trimmed && ! preg_match( '/^(?:N\.?C\.?)$/i', $trimmed ) && 1 === preg_match( '/^([A-G](?:b|#)?)/', $trimmed );
}

function parse_chord_line( string $line ) : array {
	$node_types      = get_node_types();
	$lyric_text      = '';
	$markers         = array();
	$segments        = array();
	$first_bracket   = strpos( $line, '[' );
	$lyric_position  = 0;
	$chord_offset    = 0;
	$leading_text    = '';

	if ( false !== $first_bracket && $first_bracket > 0 ) {
		$leading_text    = substr( $line, 0, $first_bracket );
		$lyric_text     .= $leading_text;
		$lyric_position += string_length( $leading_text );
	}

	preg_match_all( '/\[([^\]]*)\]([^\[]*)/u', $line, $matches, PREG_SET_ORDER );

	foreach ( $matches as $match ) {
		$chord          = $match[1];
		$lyric          = $match[2];
		$segment_length = string_length( $lyric );
		$chord_length   = string_length( $chord );
		$base_position  = $lyric_position;
		$chord_position = $lyric_position + $chord_offset;

		$markers[] = array(
			'chord'              => $chord,
			'chordPosition'      => $chord_position,
			'lyricPosition'      => $base_position,
			'lyricSegmentLength' => $segment_length,
		);
		$segments[] = array(
			'chord' => $chord,
			'lyric' => $lyric,
		);
		$lyric_text .= $lyric;

		if ( $segment_length > 0 ) {
			$lyric_position += $segment_length;
			$chord_offset    = 0;
		} else {
			$chord_offset += $chord_length + 1;
		}
	}

	$has_transposable = false;

	foreach ( $markers as $marker ) {
		if ( is_transposable_chord( $marker['chord'] ) ) {
			$has_transposable = true;
			break;
		}
	}

	return array(
		'type'                 => $node_types['chordLine'],
		'lyricText'            => $lyric_text,
		'accessibleText'       => build_accessible_chord_line( $leading_text, $segments ),
		'markers'              => $markers,
		'hasTransposableChord' => $has_transposable,
	);
}

function create_empty_document() : array {
	$spec = get_spec();

	return array(
		'meta'     => $spec['document']['metaDefaults'] ?? array(),
		'features' => $spec['document']['featureDefaults'] ?? array(),
		'nodes'    => array(),
	);
}

function assign_meta_value( array &$document, string $key, string $value ) : void {
	$meta_key = get_top_matter_item( $key )['metaKey'] ?? null;

	if ( null === $meta_key || '' !== $document['meta'][ $meta_key ] ) {
		return;
	}

	$document['meta'][ $meta_key ] = $value;
}

function flush_top_matter( array &$document, array &$pending_top_matter, bool &$top_matter_flushed ) : void {
	$node_types = get_node_types();

	if ( $top_matter_flushed ) {
		return;
	}

	$top_matter_flushed = true;

	if ( empty( $pending_top_matter ) ) {
		return;
	}

	$document['nodes'][] = array(
		'type'  => $node_types['topMatter'],
		'items' => array_values( $pending_top_matter ),
	);
}

function get_section_type( string $key ) : ?string {
	return get_spec()['structuralDirectives']['sectionStarts'][ $key ] ?? null;
}

function is_section_end_key( string $key ) : bool {
	return in_array( $key, get_spec()['structuralDirectives']['sectionEnds'] ?? array(), true );
}

function is_tab_start_key( string $key ) : bool {
	return in_array( $key, get_spec()['structuralDirectives']['tabs']['starts'] ?? array(), true );
}

function is_tab_end_key( string $key ) : bool {
	return in_array( $key, get_spec()['structuralDirectives']['tabs']['ends'] ?? array(), true );
}

function create_directive_node( string $key, string $value ) : ?array {
	$node_types = get_node_types();
	$config     = get_directive_node_config( $key );

	if ( null === $config ) {
		return null;
	}

	if ( $node_types['directive'] === $config['type'] ) {
		return array(
			'type'  => $node_types['directive'],
			'key'   => $key,
			'value' => $value,
		);
	}

	return array(
		'type'    => $node_types['comment'],
		'variant' => $config['variant'],
		'value'   => false === ( $config['includeValue'] ?? true ) ? '' : $value,
	);
}

function parse_chordpro_document( string $text ) : array {
	$node_types         = get_node_types();
	$lines              = explode( "\n", $text );
	$document           = create_empty_document();
	$lyrics_lines       = array();
	$pending_top_matter = array();
	$top_matter_flushed = false;
	$section_stack      = array();

	for ( $index = 0, $count = count( $lines ); $index < $count; $index++ ) {
		$line                 = rtrim( $lines[ $index ] );
		$structural_directive = extract_structural_directive( $line );

		if ( null !== $structural_directive ) {
			$directive_parts = get_directive_parts( $structural_directive );
			$key             = $directive_parts['key'];
			$value           = $directive_parts['value'];

			if ( is_tab_start_key( $key ) ) {
				flush_top_matter( $document, $pending_top_matter, $top_matter_flushed );
				$tab_lines = array();

				for ( $cursor = $index + 1; $cursor < $count; $cursor++ ) {
					$tab_line       = rtrim( $lines[ $cursor ] );
					$end_directive  = extract_structural_directive( $tab_line );

					if ( null !== $end_directive ) {
						$end_parts = get_directive_parts( $end_directive );

						if ( is_tab_end_key( $end_parts['key'] ) ) {
							$index = $cursor;
							break;
						}
					}

					$tab_lines[] = $tab_line;

					if ( $cursor === $count - 1 ) {
						$index = $cursor;
					}
				}

				$document['nodes'][] = array(
					'type'  => $node_types['tabBlock'],
					'lines' => $tab_lines,
				);
				continue;
			}

			$section_type = get_section_type( $key );

			if ( null !== $section_type ) {
				flush_top_matter( $document, $pending_top_matter, $top_matter_flushed );
				$section_stack[] = $section_type;
				$document['nodes'][] = array(
					'type'        => $node_types['sectionStart'],
					'sectionType' => $section_type,
					'label'       => $value,
				);
				continue;
			}

			if ( is_section_end_key( $key ) ) {
				flush_top_matter( $document, $pending_top_matter, $top_matter_flushed );

				if ( ! empty( $section_stack ) ) {
					$document['nodes'][] = array(
						'type'        => $node_types['sectionEnd'],
						'sectionType' => array_pop( $section_stack ),
					);
				}
				continue;
			}
		}

		if ( preg_match( get_directive_line_pattern(), trim( $line ), $directive_match ) ) {
			$directive_parts = get_directive_parts( $directive_match[1] );
			$key             = $directive_parts['key'];
			$value           = $directive_parts['value'];

			assign_meta_value( $document, $key, $value );

			if ( ! $top_matter_flushed && is_top_matter_directive_key( $key ) ) {
				$pending_top_matter[] = array(
					'key'          => $key,
					'value'        => $value,
					'canonicalKey' => normalize_top_matter_key( $key ),
					'priority'     => get_top_matter_priority( $key ),
					'group'        => is_meta_row_directive_key( $key ) ? 'meta_row' : 'default',
					'order'        => count( $pending_top_matter ),
				);
				continue;
			}

			flush_top_matter( $document, $pending_top_matter, $top_matter_flushed );
			$directive_node = create_directive_node( $key, $value );

			if ( null !== $directive_node ) {
				$document['nodes'][] = $directive_node;
			}
			continue;
		}

		if ( '' === trim( $line ) ) {
			flush_top_matter( $document, $pending_top_matter, $top_matter_flushed );
			$document['nodes'][] = array(
				'type' => $node_types['spacer'],
			);
			$lyrics_lines[] = '';
			continue;
		}

		if ( has_chord_tokens( $line ) ) {
			flush_top_matter( $document, $pending_top_matter, $top_matter_flushed );
			$chord_line = parse_chord_line( $line );

			$document['features']['hasChords']             = true;
			$document['features']['hasTransposableChords'] = $document['features']['hasTransposableChords'] || $chord_line['hasTransposableChord'];
			$document['nodes'][]                           = $chord_line;
			$lyrics_lines[]                                = $chord_line['lyricText'];
			continue;
		}

		flush_top_matter( $document, $pending_top_matter, $top_matter_flushed );
		$document['nodes'][] = array(
			'type' => $node_types['lyricLine'],
			'text' => $line,
		);
		$lyrics_lines[] = $line;
	}

	flush_top_matter( $document, $pending_top_matter, $top_matter_flushed );

	while ( ! empty( $section_stack ) ) {
		$document['nodes'][] = array(
			'type'        => $node_types['sectionEnd'],
			'sectionType' => array_pop( $section_stack ),
		);
	}

	$document['meta']['lyrics'] = trim( implode( "\n", $lyrics_lines ) );

	return $document;
}

function translate_section_label_prefix( string $value, array $labels ) : string {
	if ( ! preg_match( get_section_label_prefix_pattern(), $value, $matches ) ) {
		return $value;
	}

	$key = strtolower( $matches[1] );

	if ( ! isset( $labels[ $key ] ) ) {
		return $value;
	}

	return $labels[ $key ] . $matches[2];
}

function render_transpose_controls_markup( array $labels ) : string {
	$config  = get_spec()['render']['transposeControls'];
	$buttons = '';

	foreach ( $config['buttons'] as $button ) {
		$attributes = array(
			'type="button"',
			'class="' . escape_html( $button['className'] ) . '"',
			'aria-label="' . escape_html( $labels[ $button['labelKey'] ] ) . '"',
		);

		if ( 'change' === $button['kind'] ) {
			$attributes[] = 'data-transpose-change="' . escape_html( $button['value'] ) . '"';
		} elseif ( 'reset' === $button['kind'] ) {
			$attributes[] = 'data-transpose-reset';
		}

		if ( ! empty( $button['disabled'] ) ) {
			$attributes[] = 'disabled';
		}

		$label_text = isset( $button['textLabelKey'] ) ? $labels[ $button['textLabelKey'] ] : $button['text'];
		$buttons   .= '<button ' . implode( ' ', $attributes ) . '>' . escape_html( $label_text ) . '</button>';
	}

	$display = $config['display'];

	return '<div class="chordpro-transpose-controls" role="group" aria-label="' . escape_html( $labels[ $config['groupLabelKey'] ] ) . '"><strong class="chordpro-meta-label">' . escape_html( $labels[ $config['titleLabelKey'] ] ) . ':</strong>' . $buttons . '<span class="' . escape_html( $display['className'] ) . '" data-transpose-display aria-live="' . escape_html( $display['ariaLive'] ) . '" aria-atomic="' . escape_html( $display['ariaAtomic'] ) . '">' . escape_html( $display['initialValue'] ) . '</span></div>';
}

function render_directive_node( array $node, array $options, array $labels ) : string {
	$config = get_directive_render_config( $node['key'] );

	if ( null === $config ) {
		return '';
	}

	if ( ! empty( $config['option'] ) && empty( $options[ $config['option'] ] ) ) {
		return '';
	}

	if ( 'text' === $config['kind'] ) {
		return '<div class="' . escape_html( $config['className'] ) . '">' . escape_html( $node['value'] ) . '</div>';
	}

	if ( 'meta' === $config['kind'] ) {
		$data_attribute = '';

		if ( ! empty( $config['dataAttribute'] ) ) {
			$data_attribute = ' ' . $config['dataAttribute'] . '="' . escape_html( $node['value'] ) . '"';
		}

		return '<div class="chordpro-meta"><strong class="chordpro-meta-label">' . escape_html( $labels[ $config['labelKey'] ] ) . ':</strong><span class="chordpro-meta-value"' . $data_attribute . '>' . escape_html( $node['value'] ) . '</span></div>';
	}

	return '';
}

function render_top_matter_node( array $node, array &$state, array $options, array $labels ) : string {
	$node_types = get_node_types();
	$items      = $node['items'];

	usort(
		$items,
		static function ( array $first, array $second ) : int {
			if ( $first['priority'] === $second['priority'] ) {
				return $first['order'] <=> $second['order'];
			}

			return $first['priority'] <=> $second['priority'];
		}
	);

	$html           = '';
	$meta_row_items = array();

	foreach ( $items as $item ) {
		$rendered = render_directive_node(
			array(
				'type'  => $node_types['directive'],
				'key'   => $item['key'],
				'value' => $item['value'],
			),
			$options,
			$labels
		);

		if ( '' === $rendered ) {
			continue;
		}

		if ( 'meta_row' === $item['group'] ) {
			$meta_row_items[] = $rendered;
			continue;
		}

		$html .= $rendered;
	}

	if ( ! empty( $meta_row_items ) ) {
		$html .= '<div class="chordpro-meta-bar">' . implode( '', $meta_row_items ) . '</div>';

		if ( ! empty( $options['includeControls'] ) && ! $state['controlsRendered'] ) {
			$html .= '<div class="chordpro-transpose-row">' . render_transpose_controls_markup( $labels ) . '</div>';
			$state['controlsRendered'] = true;
		}
	}

	return $html;
}

function render_comment_node( array $node, array $labels ) : string {
	if ( 'comment' === $node['variant'] ) {
		return '<div class="chordpro-comment">' . escape_html( translate_section_label_prefix( $node['value'], $labels ) ) . '</div>';
	}

	return '<div class="chordpro-comment">' . escape_html( $labels[ $node['variant'] ] ) . '</div>';
}

function render_chord_line_node( array $node ) : string {
	$chord_markers = '';

	foreach ( $node['markers'] as $marker ) {
		$chord_markers .= '<p class="chordpro-chord" data-original-chord="' . escape_html( $marker['chord'] ) . '" data-lyric-position="' . escape_html( (string) $marker['lyricPosition'] ) . '" data-lyric-segment-length="' . escape_html( (string) $marker['lyricSegmentLength'] ) . '" style="left:' . escape_html( (string) $marker['chordPosition'] ) . 'ch">' . escape_html( $marker['chord'] ) . '</p>';
	}

	$accessible_text = '' !== $node['accessibleText'] ? $node['accessibleText'] : $node['lyricText'];

	return '<div class="chordpro-line chordpro-line-annotated"><span class="chordpro-accessible-line">' . escape_html( $accessible_text ) . '</span><div class="chordpro-chords" aria-hidden="true">' . $chord_markers . '</div><p class="chordpro-lyric chordpro-lyric-full" aria-hidden="true">' . escape_html( $node['lyricText'] ) . '</p></div>';
}

function render_chordpro_document( array $document, array $options = array() ) : string {
	$node_types      = get_node_types();
	$render_options  = array(
		'showTitle'       => array_key_exists( 'showTitle', $options ) ? (bool) $options['showTitle'] : true,
		'showArtist'      => array_key_exists( 'showArtist', $options ) ? (bool) $options['showArtist'] : true,
		'includeControls' => array_key_exists( 'includeControls', $options ) ? (bool) $options['includeControls'] : (bool) $document['features']['hasTransposableChords'],
	);
	$labels          = get_labels( $options['labels'] ?? array() );
	$state           = array(
		'controlsRendered' => false,
		'openSections'     => 0,
	);
	$html            = '';

	foreach ( $document['nodes'] as $node ) {
		switch ( $node['type'] ) {
			case $node_types['topMatter']:
				$html .= render_top_matter_node( $node, $state, $render_options, $labels );
				break;
			case $node_types['directive']:
				$html .= render_directive_node( $node, $render_options, $labels );
				break;
			case $node_types['comment']:
				$html .= render_comment_node( $node, $labels );
				break;
			case $node_types['sectionStart']:
				$section_label = '';

				if ( '' !== $node['label'] ) {
					$section_label = '<div class="chordpro-section-label">' . escape_html( translate_section_label_prefix( $node['label'], $labels ) ) . '</div>';
				}

				$html .= '<div class="chordpro-section chordpro-' . escape_html( $node['sectionType'] ) . '">' . $section_label;
				++$state['openSections'];
				break;
			case $node_types['sectionEnd']:
				if ( $state['openSections'] > 0 ) {
					$html .= '</div>';
					--$state['openSections'];
				}
				break;
			case $node_types['tabBlock']:
				$html .= '<pre class="chordpro-tab">' . escape_html( implode( "\n", $node['lines'] ) ) . '</pre>';
				break;
			case $node_types['spacer']:
				$html .= '<div class="chordpro-spacer"></div>';
				break;
			case $node_types['lyricLine']:
				$html .= '<div class="chordpro-line"><p class="chordpro-lyric chordpro-lyric-plain">' . escape_html( $node['text'] ) . '</p></div>';
				break;
			case $node_types['chordLine']:
				$html .= render_chord_line_node( $node );
				break;
		}
	}

	while ( $state['openSections'] > 0 ) {
		$html .= '</div>';
		--$state['openSections'];
	}

	if ( $render_options['includeControls'] && ! $state['controlsRendered'] && ! empty( $document['features']['hasTransposableChords'] ) ) {
		$html = render_transpose_controls_markup( $labels ) . $html;
	}

	return $html;
}

function build_schema_graph( array $document, string $fallback_title ) : array {
	$title = '' !== $document['meta']['title'] ? $document['meta']['title'] : $fallback_title;
	$graph = array(
		'@context' => 'https://schema.org',
		'@type'    => 'MusicComposition',
		'name'     => $title,
		'lyrics'   => array(
			'@type' => 'CreativeWork',
			'text'  => $document['meta']['lyrics'],
		),
	);

	if ( '' !== $document['meta']['subtitle'] ) {
		$graph['alternateName'] = $document['meta']['subtitle'];
	}

	if ( '' !== $document['meta']['artist'] ) {
		$graph['byArtist'] = array(
			'@type' => 'Person',
			'name'  => $document['meta']['artist'],
		);
	}

	if ( '' !== $document['meta']['composer'] ) {
		$graph['composer'] = array(
			'@type' => 'Person',
			'name'  => $document['meta']['composer'],
		);
	}

	if ( '' !== $document['meta']['lyricist'] ) {
		$graph['lyricist'] = array(
			'@type' => 'Person',
			'name'  => $document['meta']['lyricist'],
		);
	}

	if ( '' !== $document['meta']['key'] ) {
		$graph['musicalKey'] = $document['meta']['key'];
	}

	return $graph;
}
