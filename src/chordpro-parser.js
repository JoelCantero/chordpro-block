/**
 * ChordPro parser — converts ChordPro-formatted text to HTML.
 * Used in the block editor for live preview.
 *
 * Supported syntax:
 *   [Chord]lyric text        — inline chords
 *   {directive: value}       — metadata / section markers
 */

import { __, _x } from '@wordpress/i18n';

function escapeHtml( text ) {
	return String( text )
		.replace( /&/g, '&amp;' )
		.replace( /</g, '&lt;' )
		.replace( />/g, '&gt;' )
		.replace( /"/g, '&quot;' )
		.replace( /'/g, '&#039;' );
}

function translateSectionLabelPrefix( value ) {
	const match = value.match( /^(verse|chorus|bridge)(\b.*)$/i );

	if ( ! match ) {
		return value;
	}

	const map = {
		verse: __( 'Verse', 'chordpro-block' ),
		chorus: __( 'Chorus', 'chordpro-block' ),
		bridge: __( 'Bridge', 'chordpro-block' ),
	};

	const translated = map[ match[ 1 ].toLowerCase() ];

	if ( ! translated ) {
		return value;
	}

	return `${ translated }${ match[ 2 ] }`;
}

function extractStructuralDirective( line ) {
	const trimmed = line.trim();
	const match = trimmed.match(
		/^[{\[]\s*((?:start_of_|end_of_)(?:verse|chorus|bridge|tab)|sov|eov|soc|eoc|sob|eob|sot|eot)(?:\s*:\s*[^}\]]*)?\s*[}\]]$/i
	);

	if ( ! match ) {
		return null;
	}

	return match[ 1 ].trim();
}

function getDirectiveParts( raw ) {
	const trimmed = raw.trim();
	const colonPos = trimmed.indexOf( ':' );

	if ( colonPos >= 0 ) {
		return {
			key: trimmed.substring( 0, colonPos ).trim().toLowerCase(),
			value: trimmed.substring( colonPos + 1 ).trim(),
		};
	}

	return {
		key: trimmed.toLowerCase(),
		value: '',
	};
}

function normalizeTopMatterKey( key ) {
	switch ( key ) {
		case 't':
			return 'title';
		case 'st':
			return 'subtitle';
		default:
			return key;
	}
}

function isTopMatterDirectiveKey( key ) {
	return [
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
	].includes( key );
}

function getTopMatterPriority( key ) {
	switch ( normalizeTopMatterKey( key ) ) {
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

function flushTopMatter( parserState ) {
	if ( parserState.topMatterFlushed ) {
		return '';
	}

	parserState.topMatterFlushed = true;

	if ( parserState.pendingTopMatter.length === 0 ) {
		return '';
	}

	return parserState.pendingTopMatter
		.sort(
			( first, second ) =>
				first.priority - second.priority || first.order - second.order
		)
		.map( ( item ) => item.html )
		.join( '' );
}

function parseDirective( raw, parserState, options ) {
	const { key, value } = getDirectiveParts( raw );

	switch ( key ) {
		case 'title':
		case 't':
			if ( ! options.showTitle ) {
				return '';
			}
			return `<div class="chordpro-title">${ escapeHtml( value ) }</div>`;
		case 'subtitle':
		case 'st':
			return `<div class="chordpro-subtitle">${ escapeHtml(
				value
			) }</div>`;
		case 'artist':
			if ( ! options.showArtist ) {
				return '';
			}
			return `<div class="chordpro-artist">${ escapeHtml(
				value
			) }</div>`;
		case 'composer':
			return `<div class="chordpro-composer">${ escapeHtml(
				value
			) }</div>`;
		case 'lyricist':
			return `<div class="chordpro-lyricist">${ escapeHtml(
				value
			) }</div>`;
		case 'key':
			return `<div class="chordpro-meta"><strong class="chordpro-meta-label">${ escapeHtml(
				_x( 'Key', 'musical key label', 'chordpro-block' )
			) }:</strong><span class="chordpro-meta-value" data-original-key="${ escapeHtml(
				value
			) }">${ escapeHtml( value ) }</span></div>`;
		case 'capo':
			return `<div class="chordpro-meta"><strong class="chordpro-meta-label">${ escapeHtml(
				_x( 'Capo', 'guitar capo position', 'chordpro-block' )
			) }:</strong><span class="chordpro-meta-value">${ escapeHtml(
				value
			) }</span></div>`;
		case 'tempo':
			return `<div class="chordpro-meta"><strong class="chordpro-meta-label">${ escapeHtml(
				__( 'Tempo', 'chordpro-block' )
			) }:</strong><span class="chordpro-meta-value">${ escapeHtml(
				value
			) }</span></div>`;
		case 'time':
			return `<div class="chordpro-meta"><strong class="chordpro-meta-label">${ escapeHtml(
				__( 'Time', 'chordpro-block' )
			) }:</strong><span class="chordpro-meta-value">${ escapeHtml(
				value
			) }</span></div>`;
		case 'duration':
			return `<div class="chordpro-meta"><strong class="chordpro-meta-label">${ escapeHtml(
				__( 'Duration', 'chordpro-block' )
			) }:</strong><span class="chordpro-meta-value">${ escapeHtml(
				value
			) }</span></div>`;
		case 'comment':
		case 'c':
			return `<div class="chordpro-comment">${ escapeHtml(
				translateSectionLabelPrefix( value )
			) }</div>`;
		case 'chorus':
			return `<div class="chordpro-comment">${ escapeHtml(
				__( 'Chorus', 'chordpro-block' )
			) }</div>`;
		case 'verse':
			return `<div class="chordpro-comment">${ escapeHtml(
				__( 'Verse', 'chordpro-block' )
			) }</div>`;
		case 'bridge':
			return `<div class="chordpro-comment">${ escapeHtml(
				__( 'Bridge', 'chordpro-block' )
			) }</div>`;
		case 'start_of_chorus':
		case 'soc': {
			const label = value
				? `<div class="chordpro-section-label">${ escapeHtml(
						translateSectionLabelPrefix( value )
				  ) }</div>`
				: '';
			parserState.openSectionCount += 1;
			return `<div class="chordpro-section chordpro-chorus">${ label }`;
		}
		case 'end_of_chorus':
		case 'eoc':
			if ( parserState.openSectionCount > 0 ) {
				parserState.openSectionCount -= 1;
				return '</div><!-- /chorus -->';
			}
			return '';
		case 'start_of_verse':
		case 'sov': {
			const label = value
				? `<div class="chordpro-section-label">${ escapeHtml(
						translateSectionLabelPrefix( value )
				  ) }</div>`
				: '';
			parserState.openSectionCount += 1;
			return `<div class="chordpro-section chordpro-verse">${ label }`;
		}
		case 'end_of_verse':
		case 'eov':
			if ( parserState.openSectionCount > 0 ) {
				parserState.openSectionCount -= 1;
				return '</div><!-- /verse -->';
			}
			return '';
		case 'start_of_bridge':
		case 'sob': {
			const label = value
				? `<div class="chordpro-section-label">${ escapeHtml(
						translateSectionLabelPrefix( value )
				  ) }</div>`
				: '';
			parserState.openSectionCount += 1;
			return `<div class="chordpro-section chordpro-bridge">${ label }`;
		}
		case 'end_of_bridge':
		case 'eob':
			if ( parserState.openSectionCount > 0 ) {
				parserState.openSectionCount -= 1;
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
			return ''; // unknown or import-only directive — silently ignore
	}
}

function parseChordLine( line ) {
	let lyricText = '';
	let chordMarkers = '';
	const firstBracket = line.indexOf( '[' );
	let lyricPosition = 0;
	let chordOffset = 0;

	// Text before the first chord marker stays as plain lyric text.
	if ( firstBracket > 0 ) {
		const leading = line.substring( 0, firstBracket );
		lyricText += leading;
		lyricPosition += Array.from( leading ).length;
	}

	// Each [Chord]lyric pair becomes one positioned chord marker over a single lyric string.
	const pattern = /\[([^\]]*)\]([^[]*)/g;
	let match;
	while ( ( match = pattern.exec( line ) ) !== null ) {
		const segmentLength = Array.from( match[ 2 ] ).length;
		const chordLength = Array.from( match[ 1 ] ).length;
		const baseLyricPosition = lyricPosition;
		const chordPosition = lyricPosition + chordOffset;

		chordMarkers += `<p class="chordpro-chord" data-original-chord="${ escapeHtml(
			match[ 1 ]
		) }" data-lyric-position="${ baseLyricPosition }" data-lyric-segment-length="${ segmentLength }" style="left:${ chordPosition }ch">${ escapeHtml(
			match[ 1 ]
		) }</p>`;
		lyricText += match[ 2 ];

		if ( segmentLength > 0 ) {
			lyricPosition += segmentLength;
			chordOffset = 0;
		} else {
			// Keep consecutive chords grouped above the same lyric anchor without changing lyric spacing.
			chordOffset += chordLength + 1;
		}
	}

	return `<div class="chordpro-line chordpro-line-annotated"><div class="chordpro-chords" aria-hidden="true">${ chordMarkers }</div><p class="chordpro-lyric chordpro-lyric-full">${ escapeHtml(
		lyricText
	) }</p></div>`;
}

/**
 * Convert a ChordPro text string to an HTML string.
 *
 * @param {string} text    Raw ChordPro text.
 * @param {Object} options Parser display options.
 * @return {string} HTML suitable for innerHTML / dangerouslySetInnerHTML.
 */
export function parseChordPro( text, options = {} ) {
	const parserOptions = {
		showTitle: options.showTitle ?? true,
		showArtist: options.showArtist ?? true,
	};
	const lines = text.split( '\n' );
	let html = '';
	let inTab = false;
	const parserState = {
		openSectionCount: 0,
		pendingTopMatter: [],
		topMatterFlushed: false,
	};

	for ( const rawLine of lines ) {
		const line = rawLine.replace( /\s+$/, '' ); // rtrim

		// Inside a tab section: accumulate verbatim until end_of_tab.
		if ( inTab ) {
			if ( /^\{(end_of_tab|eot)\}$/i.test( line.trim() ) ) {
				inTab = false;
				html += '</pre>';
			} else {
				html += escapeHtml( line ) + '\n';
			}
			continue;
		}

		// Structural directives accept both ChordPro braces and a bracket-only fallback.
		const structuralDirective = extractStructuralDirective( line );
		if ( structuralDirective ) {
			html += flushTopMatter( parserState );

			const output = parseDirective(
				structuralDirective,
				parserState,
				parserOptions
			);
			if ( output.startsWith( '<pre' ) ) {
				inTab = true;
			}
			html += output;
			continue;
		}

		// Directive line.
		const directiveMatch = line.trim().match( /^\{([^}]+)\}$/ );
		if ( directiveMatch ) {
			const { key } = getDirectiveParts( directiveMatch[ 1 ] );

			if (
				! parserState.topMatterFlushed &&
				isTopMatterDirectiveKey( key )
			) {
				const output = parseDirective(
					directiveMatch[ 1 ],
					parserState,
					parserOptions
				);

				if ( output ) {
					parserState.pendingTopMatter.push( {
						html: output,
						priority: getTopMatterPriority( key ),
						order: parserState.pendingTopMatter.length,
					} );
				}
				continue;
			}

			html += flushTopMatter( parserState );

			const output = parseDirective(
				directiveMatch[ 1 ],
				parserState,
				parserOptions
			);
			if ( output.startsWith( '<pre' ) ) {
				inTab = true;
			}
			html += output;
			continue;
		}

		// Extra guard: if the line is only a directive (e.g. {eoc}) but not matched above, skip it.
		if ( /^[{\[]\s*[a-z_]+\s*[}\]]$/i.test( line.trim() ) ) {
			continue;
		}

		// Empty line → visual spacer.
		if ( line.trim() === '' ) {
			html += flushTopMatter( parserState );
			html += '<div class="chordpro-spacer"></div>';
			continue;
		}

		// Chord line (contains at least one [...]).
		if ( line.includes( '[' ) ) {
			html += flushTopMatter( parserState );
			html += parseChordLine( line );
			continue;
		}

		// Plain lyric line.
		html += flushTopMatter( parserState );
		html += `<div class="chordpro-line"><p class="chordpro-lyric chordpro-lyric-plain">${ escapeHtml(
			line
		) }</p></div>`;
	}

	html += flushTopMatter( parserState );

	while ( parserState.openSectionCount > 0 ) {
		html += '</div>';
		parserState.openSectionCount -= 1;
	}

	return html;
}
