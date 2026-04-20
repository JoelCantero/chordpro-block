<?php
/**
 * Pure ChordPro parser and renderer helpers.
 *
 * These functions intentionally avoid WordPress dependencies so they can be
 * reused in tests and from the block render callback.
 */

namespace ChordProBlock\Parser;

function default_labels() : array {
	return array(
		'verse'             => 'Verse',
		'chorus'            => 'Chorus',
		'bridge'            => 'Bridge',
		'keyLabel'          => 'Key',
		'capoLabel'         => 'Capo',
		'tempo'             => 'Tempo',
		'time'              => 'Time',
		'duration'          => 'Duration',
		'transpose'         => 'Transpose',
		'transposeChords'   => 'Transpose chords',
		'lowerSemitone'     => 'Lower one semitone',
		'raiseSemitone'     => 'Raise one semitone',
		'reset'             => 'Reset',
		'transposeOffset'   => 'Transpose offset 0 semitones',
		'songLyricsDefault' => 'Song Lyrics',
	);
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

function string_substr( string $value, int $start, ?int $length = null ) : string {
	if ( function_exists( 'mb_substr' ) ) {
		return null === $length ? mb_substr( $value, $start ) : mb_substr( $value, $start, $length );
	}

	$chars = preg_split( '//u', $value, -1, PREG_SPLIT_NO_EMPTY );

	if ( false === $chars ) {
		return '';
	}

	$slice = null === $length ? array_slice( $chars, $start ) : array_slice( $chars, $start, $length );

	return implode( '', $slice );
}

function string_pos( string $value, string $needle ) {
	if ( function_exists( 'mb_strpos' ) ) {
		return mb_strpos( $value, $needle );
	}

	return strpos( $value, $needle );
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

	if ( ! preg_match( '/^[{\[]\s*((?:start_of_|end_of_)(?:verse|chorus|bridge|tab)|sov|eov|soc|eoc|sob|eob|sot|eot)(?:\s*:\s*[^}\]]*)?\s*[}\]]$/i', $trimmed, $matches ) ) {
		return null;
	}

	return trim( $matches[1] );
}

function normalize_top_matter_key( string $key ) : string {
	switch ( $key ) {
		case 't':
			return 'title';
		case 'st':
			return 'subtitle';
		default:
			return $key;
	}
}

function is_top_matter_directive_key( string $key ) : bool {
	return in_array(
		$key,
		array(
			'title',
			't',
			'subtitle',
			'st',
			'artist',
			'composer',
			'lyricist',
			'tempo',
			'key',
			'capo',
			'time',
			'duration',
		),
		true
	);
}

function is_meta_row_directive_key( string $key ) : bool {
	return in_array(
		normalize_top_matter_key( $key ),
		array( 'tempo', 'key', 'capo', 'time', 'duration' ),
		true
	);
}

function get_top_matter_priority( string $key ) : int {
	switch ( normalize_top_matter_key( $key ) ) {
		case 'title':
			return 0;
		case 'subtitle':
			return 1;
		case 'artist':
			return 2;
		case 'composer':
			return 3;
		case 'lyricist':
			return 4;
		case 'tempo':
			return 5;
		case 'key':
			return 6;
		case 'capo':
			return 7;
		case 'time':
			return 8;
		case 'duration':
			return 9;
		default:
			return 100;
	}
}

function has_chord_tokens( string $line ) : bool {
	return 1 === preg_match( '/\[[^\]]+\]/u', $line );
}

function normalize_whitespace( string $value ) : string {
	return trim( preg_replace( '/\s+/u', ' ', $value ) ?? '' );
}

function build_accessible_chord_line( string $leading_text, array $segments ) : string {
	$parts = array();
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
	$lyric_text    = '';
	$markers       = array();
	$segments      = array();
	$first_bracket = strpos( $line, '[' );
	$lyric_position = 0;
	$chord_offset   = 0;
	$leading_text   = '';

	if ( false !== $first_bracket && $first_bracket > 0 ) {
		$leading_text    = substr( $line, 0, $first_bracket );
		$lyric_text     .= $leading_text;
		$lyric_position += string_length( $leading_text );
	}

	preg_match_all( '/\[([^\]]*)\]([^\[]*)/u', $line, $matches, PREG_SET_ORDER );

	foreach ( $matches as $match ) {
		$chord            = $match[1];
		$lyric            = $match[2];
		$segment_length   = string_length( $lyric );
		$chord_length     = string_length( $chord );
		$base_position    = $lyric_position;
		$chord_position   = $lyric_position + $chord_offset;

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
		'type'                => 'chord_line',
		'lyricText'           => $lyric_text,
		'accessibleText'      => build_accessible_chord_line( $leading_text, $segments ),
		'markers'             => $markers,
		'hasTransposableChord' => $has_transposable,
	);
}

function create_empty_document() : array {
	return array(
		'meta'     => array(
			'title'     => '',
			'subtitle'  => '',
			'artist'    => '',
			'composer'  => '',
			'lyricist'  => '',
			'key'       => '',
			'lyrics'    => '',
		),
		'features' => array(
			'hasChords'             => false,
			'hasTransposableChords' => false,
		),
		'nodes'    => array(),
	);
}

function assign_meta_value( array &$document, string $key, string $value ) : void {
	$meta_key_map = array(
		'title'    => 'title',
		't'        => 'title',
		'subtitle' => 'subtitle',
		'st'       => 'subtitle',
		'artist'   => 'artist',
		'composer' => 'composer',
		'lyricist' => 'lyricist',
		'key'      => 'key',
	);

	if ( ! isset( $meta_key_map[ $key ] ) ) {
		return;
	}

	$meta_key = $meta_key_map[ $key ];

	if ( '' !== $document['meta'][ $meta_key ] ) {
		return;
	}

	$document['meta'][ $meta_key ] = $value;
}

function flush_top_matter( array &$document, array &$pending_top_matter, bool &$top_matter_flushed ) : void {
	if ( $top_matter_flushed ) {
		return;
	}

	$top_matter_flushed = true;

	if ( empty( $pending_top_matter ) ) {
		return;
	}

	$document['nodes'][] = array(
		'type'  => 'top_matter',
		'items' => array_values( $pending_top_matter ),
	);
}

function get_section_type( string $key ) : ?string {
	switch ( $key ) {
		case 'start_of_chorus':
		case 'soc':
			return 'chorus';
		case 'start_of_verse':
		case 'sov':
			return 'verse';
		case 'start_of_bridge':
		case 'sob':
			return 'bridge';
		default:
			return null;
	}
}

function is_section_end_key( string $key ) : bool {
	return in_array(
		$key,
		array( 'end_of_chorus', 'eoc', 'end_of_verse', 'eov', 'end_of_bridge', 'eob' ),
		true
	);
}

function create_directive_node( string $key, string $value ) : ?array {
	switch ( $key ) {
		case 'title':
		case 't':
		case 'subtitle':
		case 'st':
		case 'artist':
		case 'composer':
		case 'lyricist':
		case 'tempo':
		case 'key':
		case 'capo':
		case 'time':
		case 'duration':
			return array(
				'type'  => 'directive',
				'key'   => $key,
				'value' => $value,
			);
		case 'comment':
		case 'c':
			return array(
				'type'    => 'comment',
				'variant' => 'comment',
				'value'   => $value,
			);
		case 'chorus':
		case 'verse':
		case 'bridge':
			return array(
				'type'    => 'comment',
				'variant' => $key,
				'value'   => '',
			);
		default:
			return null;
	}
}

function parse_chordpro_document( string $text ) : array {
	$lines              = explode( "\n", $text );
	$document           = create_empty_document();
	$lyrics_lines       = array();
	$pending_top_matter = array();
	$top_matter_flushed = false;
	$section_stack      = array();

	for ( $index = 0, $count = count( $lines ); $index < $count; $index++ ) {
		$line = rtrim( $lines[ $index ] );
		$structural_directive = extract_structural_directive( $line );

		if ( null !== $structural_directive ) {
			$directive_parts = get_directive_parts( $structural_directive );
			$key             = $directive_parts['key'];
			$value           = $directive_parts['value'];

			if ( in_array( $key, array( 'start_of_tab', 'sot' ), true ) ) {
				flush_top_matter( $document, $pending_top_matter, $top_matter_flushed );
				$tab_lines = array();

				for ( $cursor = $index + 1; $cursor < $count; $cursor++ ) {
					$tab_line = rtrim( $lines[ $cursor ] );
					$end_directive = extract_structural_directive( $tab_line );

					if ( null !== $end_directive ) {
						$end_parts = get_directive_parts( $end_directive );

						if ( in_array( $end_parts['key'], array( 'end_of_tab', 'eot' ), true ) ) {
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
					'type'  => 'tab_block',
					'lines' => $tab_lines,
				);
				continue;
			}

			$section_type = get_section_type( $key );

			if ( null !== $section_type ) {
				flush_top_matter( $document, $pending_top_matter, $top_matter_flushed );
				$section_stack[] = $section_type;
				$document['nodes'][] = array(
					'type'        => 'section_start',
					'sectionType' => $section_type,
					'label'       => $value,
				);
				continue;
			}

			if ( is_section_end_key( $key ) ) {
				flush_top_matter( $document, $pending_top_matter, $top_matter_flushed );

				if ( ! empty( $section_stack ) ) {
					$document['nodes'][] = array(
						'type'        => 'section_end',
						'sectionType' => array_pop( $section_stack ),
					);
				}
				continue;
			}
		}

		if ( preg_match( '/^\{([^}]+)\}$/', trim( $line ), $directive_match ) ) {
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
				'type' => 'spacer',
			);
			$lyrics_lines[] = '';
			continue;
		}

		if ( has_chord_tokens( $line ) ) {
			flush_top_matter( $document, $pending_top_matter, $top_matter_flushed );
			$chord_line = parse_chord_line( $line );

			$document['features']['hasChords'] = true;
			$document['features']['hasTransposableChords'] = $document['features']['hasTransposableChords'] || $chord_line['hasTransposableChord'];
			$document['nodes'][] = $chord_line;
			$lyrics_lines[] = $chord_line['lyricText'];
			continue;
		}

		flush_top_matter( $document, $pending_top_matter, $top_matter_flushed );
		$document['nodes'][] = array(
			'type' => 'lyric_line',
			'text' => $line,
		);
		$lyrics_lines[] = $line;
	}

	flush_top_matter( $document, $pending_top_matter, $top_matter_flushed );

	while ( ! empty( $section_stack ) ) {
		$document['nodes'][] = array(
			'type'        => 'section_end',
			'sectionType' => array_pop( $section_stack ),
		);
	}

	$document['meta']['lyrics'] = trim( implode( "\n", $lyrics_lines ) );

	return $document;
}

function translate_section_label_prefix( string $value, array $labels ) : string {
	if ( ! preg_match( '/^(verse|chorus|bridge)(\b.*)$/i', $value, $matches ) ) {
		return $value;
	}

	$key = strtolower( $matches[1] );

	if ( ! isset( $labels[ $key ] ) ) {
		return $value;
	}

	return $labels[ $key ] . $matches[2];
}

function render_transpose_controls_markup( array $labels ) : string {
	return '<div class="chordpro-transpose-controls" role="group" aria-label="' . escape_html( $labels['transposeChords'] ) . '"><strong class="chordpro-meta-label">' . escape_html( $labels['transpose'] ) . ':</strong><button type="button" class="chordpro-transpose-button" data-transpose-change="-1" aria-label="' . escape_html( $labels['lowerSemitone'] ) . '">-</button><button type="button" class="chordpro-transpose-button" data-transpose-change="1" aria-label="' . escape_html( $labels['raiseSemitone'] ) . '">+</button><button type="button" class="chordpro-transpose-reset" data-transpose-reset disabled>' . escape_html( $labels['reset'] ) . '</button><span class="chordpro-transpose-value" data-transpose-display aria-live="polite" aria-atomic="true">0</span></div>';
}

function render_directive_node( array $node, array $options, array $labels ) : string {
	switch ( $node['key'] ) {
		case 'title':
		case 't':
			if ( empty( $options['showTitle'] ) ) {
				return '';
			}
			return '<div class="chordpro-title">' . escape_html( $node['value'] ) . '</div>';
		case 'subtitle':
		case 'st':
			return '<div class="chordpro-subtitle">' . escape_html( $node['value'] ) . '</div>';
		case 'artist':
			if ( empty( $options['showArtist'] ) ) {
				return '';
			}
			return '<div class="chordpro-artist">' . escape_html( $node['value'] ) . '</div>';
		case 'composer':
			return '<div class="chordpro-composer">' . escape_html( $node['value'] ) . '</div>';
		case 'lyricist':
			return '<div class="chordpro-lyricist">' . escape_html( $node['value'] ) . '</div>';
		case 'key':
			return '<div class="chordpro-meta"><strong class="chordpro-meta-label">' . escape_html( $labels['keyLabel'] ) . ':</strong><span class="chordpro-meta-value" data-original-key="' . escape_html( $node['value'] ) . '">' . escape_html( $node['value'] ) . '</span></div>';
		case 'capo':
			return '<div class="chordpro-meta"><strong class="chordpro-meta-label">' . escape_html( $labels['capoLabel'] ) . ':</strong><span class="chordpro-meta-value">' . escape_html( $node['value'] ) . '</span></div>';
		case 'tempo':
			return '<div class="chordpro-meta"><strong class="chordpro-meta-label">' . escape_html( $labels['tempo'] ) . ':</strong><span class="chordpro-meta-value">' . escape_html( $node['value'] ) . '</span></div>';
		case 'time':
			return '<div class="chordpro-meta"><strong class="chordpro-meta-label">' . escape_html( $labels['time'] ) . ':</strong><span class="chordpro-meta-value">' . escape_html( $node['value'] ) . '</span></div>';
		case 'duration':
			return '<div class="chordpro-meta"><strong class="chordpro-meta-label">' . escape_html( $labels['duration'] ) . ':</strong><span class="chordpro-meta-value">' . escape_html( $node['value'] ) . '</span></div>';
		default:
			return '';
	}
}

function render_top_matter_node( array $node, array &$state, array $options, array $labels ) : string {
	$items = $node['items'];
	usort(
		$items,
		static function ( array $first, array $second ) : int {
			if ( $first['priority'] === $second['priority'] ) {
				return $first['order'] <=> $second['order'];
			}

			return $first['priority'] <=> $second['priority'];
		}
	);

	$html          = '';
	$meta_row_items = array();

	foreach ( $items as $item ) {
		$rendered = render_directive_node(
			array(
				'type'  => 'directive',
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
	$render_options = array(
		'showTitle'       => array_key_exists( 'showTitle', $options ) ? (bool) $options['showTitle'] : true,
		'showArtist'      => array_key_exists( 'showArtist', $options ) ? (bool) $options['showArtist'] : true,
		'includeControls' => array_key_exists( 'includeControls', $options ) ? (bool) $options['includeControls'] : (bool) $document['features']['hasTransposableChords'],
	);
	$labels = get_labels( $options['labels'] ?? array() );
	$state  = array(
		'controlsRendered' => false,
		'openSections'     => 0,
	);
	$html = '';

	foreach ( $document['nodes'] as $node ) {
		switch ( $node['type'] ) {
			case 'top_matter':
				$html .= render_top_matter_node( $node, $state, $render_options, $labels );
				break;
			case 'directive':
				$html .= render_directive_node( $node, $render_options, $labels );
				break;
			case 'comment':
				$html .= render_comment_node( $node, $labels );
				break;
			case 'section_start':
				$section_label = '';

				if ( '' !== $node['label'] ) {
					$section_label = '<div class="chordpro-section-label">' . escape_html( translate_section_label_prefix( $node['label'], $labels ) ) . '</div>';
				}

				$html .= '<div class="chordpro-section chordpro-' . escape_html( $node['sectionType'] ) . '">' . $section_label;
				++$state['openSections'];
				break;
			case 'section_end':
				if ( $state['openSections'] > 0 ) {
					$html .= '</div>';
					--$state['openSections'];
				}
				break;
			case 'tab_block':
				$html .= '<pre class="chordpro-tab">' . escape_html( implode( "\n", $node['lines'] ) ) . '</pre>';
				break;
			case 'spacer':
				$html .= '<div class="chordpro-spacer"></div>';
				break;
			case 'lyric_line':
				$html .= '<div class="chordpro-line"><p class="chordpro-lyric chordpro-lyric-plain">' . escape_html( $node['text'] ) . '</p></div>';
				break;
			case 'chord_line':
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
