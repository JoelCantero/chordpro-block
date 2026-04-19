<?php
/**
 * Server-side render for the ChordPro block.
 *
 * Available variables:
 *   $attributes  (array)    — Block attributes.
 *   $content     (string)   — InnerBlocks content (unused here).
 *   $block       (WP_Block) — Block instance.
 *
 * NOTE: Do not declare functions with the `function` keyword here.
 * render.php is required on every block render, so global functions would be
 * re-declared and cause fatal errors when the block appears more than once.
 * Use closures instead.
 */

if ( empty( $attributes['content'] ) ) {
	return;
}

$raw_content = $attributes['content'];
$storage_key = 'chordpro-block:' . md5( $raw_content );
$chord_color = '';
if ( ! empty( $attributes['chordColor'] ) ) {
	$chord_color = sanitize_hex_color( $attributes['chordColor'] );
} else {
	// Intentar obtener el color primario del tema (WordPress 5.9+ con theme.json o paleta de colores clásica)
	$primary = '';
	if ( function_exists( 'wp_get_global_settings' ) ) {
		$theme_json = wp_get_global_settings( array( 'color', 'palette' ) );
		if ( ! empty( $theme_json ) && is_array( $theme_json ) ) {
			foreach ( $theme_json as $color ) {
				if ( isset( $color['slug'] ) && $color['slug'] === 'primary' && ! empty( $color['color'] ) ) {
					$primary = $color['color'];
					break;
				}
			}
		}
	}
	// Fallback: paleta clásica
	if ( empty( $primary ) && function_exists( 'get_theme_support' ) ) {
		$palette = get_theme_support( 'editor-color-palette' );
		if ( ! empty( $palette[0] ) && is_array( $palette[0] ) ) {
			foreach ( $palette[0] as $color ) {
				if ( isset( $color['slug'] ) && $color['slug'] === 'primary' && ! empty( $color['color'] ) ) {
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

// Build font class based on selection
$font_class = '';
if ( 'roboto' === $font_family ) {
	$font_class = 'chordpro-font-roboto';
} elseif ( 'martian' === $font_family ) {
	$font_class = 'chordpro-font-martian';
}

/**
 * Extract structured metadata and plain lyrics from raw ChordPro text.
 *
 * @param string $text Raw ChordPro content.
 * @return array{name:string,subtitle:string,artist:string,composer:string,lyricist:string,key:string,lyrics:string}
 */
$extract_schema_data = static function ( string $text ) : array {
	$lines = explode( "\n", $text );
	$data  = array(
		'name'     => '',
		'subtitle' => '',
		'artist'   => '',
		'composer' => '',
		'lyricist' => '',
		'key'      => '',
		'lyrics'   => '',
	);
	$lyrics_lines = array();

	foreach ( $lines as $raw_line ) {
		$line = rtrim( $raw_line );

		if ( preg_match( '/^[{\[]\s*((?:start_of_|end_of_)(?:verse|chorus|bridge|tab)|sov|eov|soc|eoc|sob|eob|sot|eot)(?:\s*:\s*[^}\]]*)?\s*[}\]]$/i', trim( $line ) ) ) {
			continue;
		}

		   if ( preg_match( '/^\{([^}]+)\}$/', trim( $line ), $directive_match ) ) {
			   $directive = $directive_match[1];
			   $colon_pos = strpos( $directive, ':' );

			   if ( false !== $colon_pos ) {
				   $key   = strtolower( trim( substr( $directive, 0, $colon_pos ) ) );
				   $value = trim( substr( $directive, $colon_pos + 1 ) );
			   } else {
				   $key   = strtolower( trim( $directive ) );
				   $value = '';
			   }

			   // Ignorar directivas de sección para que no pasen como texto.
			   if ( in_array( $key, [
				   'start_of_verse', 'end_of_verse', 'sov', 'eov',
				   'start_of_chorus', 'end_of_chorus', 'soc', 'eoc',
				   'start_of_bridge', 'end_of_bridge', 'sob', 'eob',
				   'start_of_tab', 'end_of_tab', 'sot', 'eot',
			   ], true ) ) {
				   continue;
			   }

			   switch ( $key ) {
				   case 'title':
				   case 't':
					   if ( '' === $data['name'] ) {
						   $data['name'] = $value;
					   }
					   break;

				   case 'subtitle':
				   case 'st':
					   if ( '' === $data['subtitle'] ) {
						   $data['subtitle'] = $value;
					   }
					   break;

				case 'artist':
					if ( '' === $data['artist'] ) {
						$data['artist'] = $value;
					}
					break;

				case 'composer':
					if ( '' === $data['composer'] ) {
						$data['composer'] = $value;
					}
					break;

				case 'lyricist':
					if ( '' === $data['lyricist'] ) {
						$data['lyricist'] = $value;
					}
					break;

				case 'key':
					if ( '' === $data['key'] ) {
						$data['key'] = $value;
					}
					break;
			}

			continue;
		}

		// Remove inline [Chord] tokens and keep only lyric text.
		$lyrics_lines[] = preg_replace( '/\[[^\]]*\]/u', '', $line );
	}

	$data['lyrics'] = trim( implode( "\n", $lyrics_lines ) );

	if ( '' === $data['name'] ) {
		$data['name'] = __( 'Song Lyrics', 'chordpro-block' );
	}

	return $data;
};

$schema_source = $extract_schema_data( $raw_content );
$schema_graph  = array(
	'@context' => 'https://schema.org',
	'@type'    => 'MusicComposition',
	'name'     => $schema_source['name'],
	'lyrics'   => array(
		'@type' => 'CreativeWork',
		'text'  => $schema_source['lyrics'],
	),
);

if ( '' !== $schema_source['subtitle'] ) {
	$schema_graph['alternateName'] = $schema_source['subtitle'];
}

if ( '' !== $schema_source['artist'] ) {
	$schema_graph['byArtist'] = array(
		'@type' => 'Person',
		'name'  => $schema_source['artist'],
	);
}

if ( '' !== $schema_source['composer'] ) {
	$schema_graph['composer'] = array(
		'@type' => 'Person',
		'name'  => $schema_source['composer'],
	);
}

if ( '' !== $schema_source['lyricist'] ) {
	$schema_graph['lyricist'] = array(
		'@type' => 'Person',
		'name'  => $schema_source['lyricist'],
	);
}

if ( '' !== $schema_source['key'] ) {
	$schema_graph['musicalKey'] = $schema_source['key'];
}

$schema_json = wp_json_encode( $schema_graph, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );

// ---------------------------------------------------------------------------
// Helpers (closures — safe for multiple renders on the same page)
// ---------------------------------------------------------------------------

/**
 * Render the transpose controls markup.
 *
 * @return string HTML fragment.
 */
$render_transpose_controls = static function () : string {
	return '<div class="chordpro-transpose-controls" role="group" aria-label="'
		. esc_attr__( 'Transpose chords', 'chordpro-block' )
		. '"><div class="chordpro-meta-key-row"><strong>'
		. esc_html__( 'Transpose', 'chordpro-block' )
		. ':</strong>&nbsp;<button type="button" class="chordpro-transpose-button" data-transpose-change="-1" aria-label="'
		. esc_attr__( 'Lower one semitone', 'chordpro-block' )
		. '">-</button><button type="button" class="chordpro-transpose-button" data-transpose-change="1" aria-label="'
		. esc_attr__( 'Raise one semitone', 'chordpro-block' )
		. '">+</button><button type="button" class="chordpro-transpose-reset" data-transpose-reset>'
		. esc_html__( 'Reset', 'chordpro-block' )
		. '</button></div></div>';
};

/**
 * Translate known section prefixes in free-form comment directives.
 *
 * Example: "Verse 1" -> "Verso 1" in translated locales.
 *
 * @param string $value Comment value.
 * @return string
 */
$translate_section_label_prefix = static function ( string $value ) : string {
	if ( ! preg_match( '/^(verse|chorus|bridge)(\b.*)$/i', $value, $matches ) ) {
		return $value;
	}

	$prefix = strtolower( $matches[1] );
	$suffix = $matches[2];

	$map = array(
		'verse'  => esc_html__( 'Verse', 'chordpro-block' ),
		'chorus' => esc_html__( 'Chorus', 'chordpro-block' ),
		'bridge' => esc_html__( 'Bridge', 'chordpro-block' ),
	);

	if ( ! isset( $map[ $prefix ] ) ) {
		return $value;
	}

	return $map[ $prefix ] . $suffix;
};

/**
 * Extract structural directives written as a standalone line.
 *
 * Supports regular ChordPro `{...}` syntax and a bracket-only fallback
 * like `[end_of_chorus]` so malformed imports do not render as chords.
 *
 * @param string $line Raw line.
 * @return string|null
 */
$extract_structural_directive = static function ( string $line ) : ?string {
	$trimmed = trim( $line );

	if ( ! preg_match( '/^[{\[]\s*((?:start_of_|end_of_)(?:verse|chorus|bridge|tab)|sov|eov|soc|eoc|sob|eob|sot|eot)(?:\s*:\s*[^}\]]*)?\s*[}\]]$/i', $trimmed, $matches ) ) {
		return null;
	}

	return trim( $matches[1] );
};

/**
 * Parse a raw directive string (content inside {…}) and return HTML.
 *
 * @param string $directive Raw directive, e.g. "t: Amazing Grace" or "soc".
 * @return string HTML fragment.
 */
$controls_rendered = false;
$open_section_count = 0;

$parse_directive = static function ( string $directive ) use ( $render_transpose_controls, $translate_section_label_prefix, &$controls_rendered, &$open_section_count, $show_title, $show_artist ) : string {
	$colon_pos = strpos( $directive, ':' );

	if ( false !== $colon_pos ) {
		$key   = strtolower( trim( substr( $directive, 0, $colon_pos ) ) );
		$value = trim( substr( $directive, $colon_pos + 1 ) );
	} else {
		$key   = strtolower( trim( $directive ) );
		$value = '';
	}

	switch ( $key ) {
		case 'title':
		case 't':
			if ( ! $show_title ) {
				return '';
			}
			return '<div class="chordpro-title">' . esc_html( $value ) . '</div>';

		case 'subtitle':
		case 'st':
			return '<div class="chordpro-subtitle">' . esc_html( $value ) . '</div>';

		case 'artist':
			if ( ! $show_artist ) {
				return '';
			}
			return '<div class="chordpro-artist">' . esc_html( $value ) . '</div>';

		case 'composer':
			return '<div class="chordpro-composer">' . esc_html( $value ) . '</div>';

		case 'lyricist':
			return '<div class="chordpro-lyricist">' . esc_html( $value ) . '</div>';

		case 'key':
			$controls = '';

			if ( ! $controls_rendered ) {
				$controls          = $render_transpose_controls();
				$controls_rendered = true;
			}

			return '<div class="chordpro-meta chordpro-meta-key"><div class="chordpro-meta-key-row"><strong>'
				. esc_html_x( 'Key', 'musical key label', 'chordpro-block' )
				. ':</strong> <span class="chordpro-meta-value" data-original-key="' . esc_attr( $value ) . '">' . esc_html( $value ) . '</span></div>' . $controls . '</div>';

		case 'capo':
			return '<div class="chordpro-meta"><strong>'
				. esc_html_x( 'Capo', 'guitar capo position', 'chordpro-block' )
				. ':</strong> ' . esc_html( $value ) . '</div>';

		case 'tempo':
			return '<div class="chordpro-meta"><strong>'
				. esc_html__( 'Tempo', 'chordpro-block' )
				. ':</strong> ' . esc_html( $value ) . '</div>';

		case 'time':
			return '<div class="chordpro-meta"><strong>'
				. esc_html__( 'Time', 'chordpro-block' )
				. ':</strong> ' . esc_html( $value ) . '</div>';

		case 'duration':
			return '<div class="chordpro-meta"><strong>'
				. esc_html__( 'Duration', 'chordpro-block' )
				. ':</strong> ' . esc_html( $value ) . '</div>';

		case 'comment':
		case 'c':
			return '<div class="chordpro-comment">' . esc_html( $translate_section_label_prefix( $value ) ) . '</div>';

		case 'chorus':
			return '<div class="chordpro-comment">' . esc_html__( 'Chorus', 'chordpro-block' ) . '</div>';

		case 'verse':
			return '<div class="chordpro-comment">' . esc_html__( 'Verse', 'chordpro-block' ) . '</div>';

		case 'bridge':
			return '<div class="chordpro-comment">' . esc_html__( 'Bridge', 'chordpro-block' ) . '</div>';

		case 'start_of_chorus':
		case 'soc': {
			$label = $value
				? '<div class="chordpro-section-label">' . esc_html( $translate_section_label_prefix( $value ) ) . '</div>'
				: '';
			++$open_section_count;
			return '<div class="chordpro-section chordpro-chorus">' . $label;
		}

		case 'end_of_chorus':
		case 'eoc':
			if ( $open_section_count > 0 ) {
				--$open_section_count;
				return '</div><!-- /chorus -->';
			}
			return '';

		case 'start_of_verse':
		case 'sov': {
			$label = $value
				? '<div class="chordpro-section-label">' . esc_html( $translate_section_label_prefix( $value ) ) . '</div>'
				: '';
			++$open_section_count;
			return '<div class="chordpro-section chordpro-verse">' . $label;
		}

		case 'end_of_verse':
		case 'eov':
			if ( $open_section_count > 0 ) {
				--$open_section_count;
				return '</div><!-- /verse -->';
			}
			return '';

		case 'start_of_bridge':
		case 'sob': {
			$label = $value
				? '<div class="chordpro-section-label">' . esc_html( $translate_section_label_prefix( $value ) ) . '</div>'
				: '';
			++$open_section_count;
			return '<div class="chordpro-section chordpro-bridge">' . $label;
		}

		case 'end_of_bridge':
		case 'eob':
			if ( $open_section_count > 0 ) {
				--$open_section_count;
				return '</div><!-- /bridge -->';
			}
			return '';

		case 'start_of_tab':
		case 'sot':
			return '<pre class="chordpro-tab">';

		case 'end_of_tab':
		case 'eot':
			return '</pre>';

		default:
			return ''; // Unknown or import-only directive — silently ignored.
	}
};

/**
 * Parse a chord line (a line containing inline [Chord] markers) into HTML.
 *
 * @param string $line A single ChordPro lyric line.
 * @return string HTML fragment.
 */
$parse_chord_line = static function ( string $line ) : string {
	$lyric_text      = '';
	$chord_markers   = '';
	$first_bracket   = mb_strpos( $line, '[' );
	$lyric_position  = 0;
	$chord_offset    = 0;

	// Any text before the first chord marker is plain lyric text.
	if ( false !== $first_bracket && $first_bracket > 0 ) {
		$leading         = mb_substr( $line, 0, $first_bracket );
		$lyric_text     .= $leading;
		$lyric_position += mb_strlen( $leading );
	}

	// Each [Chord]lyric pair becomes one positioned chord marker over a single lyric string.
	preg_match_all( '/\[([^\]]*)\]([^\[]*)/u', $line, $matches, PREG_SET_ORDER );

	foreach ( $matches as $match ) {
		$original_chord = $match[1];
		$lyric_segment  = $match[2];
		$segment_length = mb_strlen( $lyric_segment );
		$chord_length   = mb_strlen( $original_chord );
		$base_lyric_position = $lyric_position;
		$chord_position = $lyric_position + $chord_offset;

		$chord_markers .= '<p class="chordpro-chord" data-original-chord="' . esc_attr( $original_chord ) . '" data-lyric-position="' . esc_attr( (string) $base_lyric_position ) . '" data-lyric-segment-length="' . esc_attr( (string) $segment_length ) . '" style="left:' . esc_attr( (string) $chord_position ) . 'ch">' . esc_html( $original_chord ) . '</p>';
		$lyric_text    .= $lyric_segment;

		if ( $segment_length > 0 ) {
			$lyric_position += $segment_length;
			$chord_offset   = 0;
		} else {
			// Keep back-to-back chords grouped above the same lyric anchor.
			$chord_offset += $chord_length + 1;
		}
	}

	return '<div class="chordpro-line chordpro-line-annotated"><div class="chordpro-chords" aria-hidden="true">' . $chord_markers . '</div><p class="chordpro-lyric chordpro-lyric-full">' . esc_html( $lyric_text ) . '</p></div>';
};

/**
 * Convert the full ChordPro text to an HTML string.
 *
 * @param string $text Raw ChordPro content.
 * @return string Rendered HTML.
 */
$parse = static function ( string $text ) use ( $parse_directive, $parse_chord_line, $extract_structural_directive, &$open_section_count ) : string {
	$lines  = explode( "\n", $text );
	$html   = '';
	$in_tab = false;

	foreach ( $lines as $raw_line ) {
		$line = rtrim( $raw_line );

		// Inside a tab section: preserve verbatim until end_of_tab.
		if ( $in_tab ) {
			if ( preg_match( '/^\{(end_of_tab|eot)\}$/i', trim( $line ) ) ) {
				$in_tab = false;
				$html  .= '</pre>';
			} else {
				$html .= esc_html( $line ) . "\n";
			}
			continue;
		}

		// Structural directives accept both ChordPro braces and a bracket-only fallback.
		$structural_directive = $extract_structural_directive( $line );
		if ( null !== $structural_directive ) {
			$colon = strpos( $structural_directive, ':' );
			$key   = strtolower( trim( false !== $colon ? substr( $structural_directive, 0, $colon ) : $structural_directive ) );
			$output = $parse_directive( $structural_directive );

			if ( in_array( $key, array( 'start_of_tab', 'sot' ), true ) ) {
				$in_tab = true;
			}

			$html .= $output;
			continue;
		}

		// Directive line: {key} or {key: value}.
		if ( preg_match( '/^\{([^}]+)\}$/', trim( $line ), $m ) ) {
			// Determine key to track tab state without depending on HTML output.
			$colon = strpos( $m[1], ':' );
			$key   = strtolower( trim( false !== $colon ? substr( $m[1], 0, $colon ) : $m[1] ) );

			$output = $parse_directive( $m[1] );

			if ( in_array( $key, array( 'start_of_tab', 'sot' ), true ) ) {
				$in_tab = true;
			}

			$html .= $output;
			continue;
		}

		// Empty line → visual spacer.
		if ( '' === trim( $line ) ) {
			$html .= '<div class="chordpro-spacer"></div>';
			continue;
		}

		// Chord line (contains at least one [...]).
		if ( false !== strpos( $line, '[' ) ) {
			$html .= $parse_chord_line( $line );
			continue;
		}

		// Plain lyric line (no chords).
		$html .= '<div class="chordpro-line"><p class="chordpro-lyric chordpro-lyric-plain">' . esc_html( $line ) . '</p></div>';
	}

	while ( $open_section_count > 0 ) {
		$html .= '</div>';
		--$open_section_count;
	}

	return $html;
};

$song_html = $parse( $raw_content );

if ( ! $controls_rendered ) {
	$song_html = $render_transpose_controls() . $song_html;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

printf(
	'<div %1$s data-transpose-storage-key="%2$s"><div class="chordpro-song%6$s"%5$s>%3$s</div>%4$s</div>',
	get_block_wrapper_attributes(),
	esc_attr( $storage_key ),
	$song_html,
	$schema_json ? '<script type="application/ld+json">' . $schema_json . '</script>' : '',
	$chord_color ? ' style="--chordpro-chord-color:' . esc_attr( $chord_color ) . ';"' : '',
	$font_class ? ' ' . esc_attr( $font_class ) : ''
);
