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

function parseDirective( raw, parserState, options ) {
	const trimmed = raw.trim();
	const colonPos = trimmed.indexOf( ':' );
	let key, value;

	if ( colonPos >= 0 ) {
		key = trimmed.substring( 0, colonPos ).trim().toLowerCase();
		value = trimmed.substring( colonPos + 1 ).trim();
	} else {
		key = trimmed.toLowerCase();
		value = '';
	}

	switch ( key ) {
		case 'title':
		case 't':
			if ( ! options.showTitle ) {
				return '';
			}
			return `<div class="chordpro-title">${ escapeHtml( value ) }</div>`;
		case 'subtitle':
		case 'st':
			return `<div class="chordpro-subtitle">${ escapeHtml( value ) }</div>`;
		case 'artist':
			if ( ! options.showArtist ) {
				return '';
			}
			return `<div class="chordpro-artist">${ escapeHtml( value ) }</div>`;
		case 'composer':
			return `<div class="chordpro-composer">${ escapeHtml( value ) }</div>`;
		case 'lyricist':
			return `<div class="chordpro-lyricist">${ escapeHtml( value ) }</div>`;
		case 'key':
			return `<div class="chordpro-meta"><strong>${ escapeHtml( _x( 'Key', 'musical key label', 'chordpro-block' ) ) }:</strong> ${ escapeHtml( value ) }</div>`;
		case 'capo':
			return `<div class="chordpro-meta"><strong>${ escapeHtml( _x( 'Capo', 'guitar capo position', 'chordpro-block' ) ) }:</strong> ${ escapeHtml( value ) }</div>`;
		case 'tempo':
			return `<div class="chordpro-meta"><strong>${ escapeHtml( __( 'Tempo', 'chordpro-block' ) ) }:</strong> ${ escapeHtml( value ) }</div>`;
		case 'time':
			return `<div class="chordpro-meta"><strong>${ escapeHtml( __( 'Time', 'chordpro-block' ) ) }:</strong> ${ escapeHtml( value ) }</div>`;
		case 'duration':
			return `<div class="chordpro-meta"><strong>${ escapeHtml( __( 'Duration', 'chordpro-block' ) ) }:</strong> ${ escapeHtml( value ) }</div>`;
		case 'comment':
		case 'c':
			return `<div class="chordpro-comment">${ escapeHtml( translateSectionLabelPrefix( value ) ) }</div>`;
		case 'chorus':
			return `<div class="chordpro-comment">${ escapeHtml( __( 'Chorus', 'chordpro-block' ) ) }</div>`;
		case 'verse':
			return `<div class="chordpro-comment">${ escapeHtml( __( 'Verse', 'chordpro-block' ) ) }</div>`;
		case 'bridge':
			return `<div class="chordpro-comment">${ escapeHtml( __( 'Bridge', 'chordpro-block' ) ) }</div>`;
		case 'start_of_chorus':
		case 'soc': {
			const label = value
				? `<div class="chordpro-section-label">${ escapeHtml( translateSectionLabelPrefix( value ) ) }</div>`
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
				? `<div class="chordpro-section-label">${ escapeHtml( translateSectionLabelPrefix( value ) ) }</div>`
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
				? `<div class="chordpro-section-label">${ escapeHtml( translateSectionLabelPrefix( value ) ) }</div>`
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
		chordMarkers += `<p class="chordpro-chord" data-original-chord="${ escapeHtml( match[ 1 ] ) }" data-lyric-segment-length="${ segmentLength }" style="left:${ lyricPosition }ch">${ escapeHtml( match[ 1 ] ) }</p>`;
		lyricText += match[ 2 ];

		if ( segmentLength > 0 ) {
			lyricPosition += segmentLength;
		} else {
			// Reserve room for consecutive chords without lyric text — add spaces to make room visible.
			const reserved = Array.from( match[ 1 ] ).length + 1;
			lyricPosition += reserved;
			lyricText += ' '.repeat( reserved );
		}
	}

	return `<div class="chordpro-line chordpro-line-annotated"><div class="chordpro-chords" aria-hidden="true">${ chordMarkers }</div><p class="chordpro-lyric chordpro-lyric-full">${ escapeHtml( lyricText ) }</p></div>`;
}

/**
 * Convert a ChordPro text string to an HTML string.
 *
 * @param {string} text Raw ChordPro text.
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

		// Directive line.
		const directiveMatch = line.trim().match( /^\{([^}]+)\}$/ );
		if ( directiveMatch ) {
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

		// Empty line → visual spacer.
		if ( line.trim() === '' ) {
			html += '<div class="chordpro-spacer"></div>';
			continue;
		}

		// Chord line (contains at least one [...]).
		if ( line.includes( '[' ) ) {
			html += parseChordLine( line );
			continue;
		}

		// Plain lyric line.
		html += `<div class="chordpro-line"><p class="chordpro-lyric chordpro-lyric-plain">${ escapeHtml( line ) }</p></div>`;
	}

	while ( parserState.openSectionCount > 0 ) {
		html += '</div>';
		parserState.openSectionCount -= 1;
	}

	return html;
}
