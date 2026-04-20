import { __, _x } from '@wordpress/i18n';
import { isTransposableChord } from './chordpro-transpose';

const STRUCTURAL_DIRECTIVE_RE =
	/^[{\[]\s*((?:start_of_|end_of_)(?:verse|chorus|bridge|tab)|sov|eov|soc|eoc|sob|eob|sot|eot)(?:\s*:\s*[^}\]]*)?\s*[}\]]$/i;
const DIRECTIVE_LINE_RE = /^\{([^}]+)\}$/;
const CHORD_TOKEN_RE = /\[[^\]]+\]/;

const TOP_MATTER_KEYS = [
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
];

function escapeHtml( text ) {
	return String( text )
		.replace( /&/g, '&amp;' )
		.replace( /</g, '&lt;' )
		.replace( />/g, '&gt;' )
		.replace( /"/g, '&quot;' )
		.replace( /'/g, '&#039;' );
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

function extractStructuralDirective( line ) {
	const trimmed = line.trim();
	const match = trimmed.match( STRUCTURAL_DIRECTIVE_RE );

	if ( ! match ) {
		return null;
	}

	return match[ 1 ].trim();
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
	return TOP_MATTER_KEYS.includes( key );
}

function isMetaRowDirectiveKey( key ) {
	return [ 'tempo', 'key', 'capo', 'time', 'duration' ].includes(
		normalizeTopMatterKey( key )
	);
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

function hasChordTokens( line ) {
	return CHORD_TOKEN_RE.test( line );
}

function buildAccessibleChordLine( leadingText, segments ) {
	const parts = [];
	const normalizedLeadingText = leadingText.replace( /\s+/g, ' ' ).trim();

	if ( normalizedLeadingText ) {
		parts.push( normalizedLeadingText );
	}

	segments.forEach( ( segment ) => {
		const segmentParts = [ segment.chord, segment.lyric ]
			.join( ' ' )
			.replace( /\s+/g, ' ' )
			.trim();

		if ( segmentParts ) {
			parts.push( segmentParts );
		}
	} );

	return parts.join( ' ' ).trim();
}

function parseChordLine( line ) {
	let lyricText = '';
	const markers = [];
	const firstBracket = line.indexOf( '[' );
	let lyricPosition = 0;
	let chordOffset = 0;
	let leadingText = '';
	const segments = [];

	if ( firstBracket > 0 ) {
		leadingText = line.substring( 0, firstBracket );
		lyricText += leadingText;
		lyricPosition += Array.from( leadingText ).length;
	}

	const pattern = /\[([^\]]*)\]([^[]*)/g;
	let match;

	while ( ( match = pattern.exec( line ) ) !== null ) {
		const chord = match[ 1 ];
		const lyric = match[ 2 ];
		const segmentLength = Array.from( lyric ).length;
		const chordLength = Array.from( chord ).length;
		const baseLyricPosition = lyricPosition;
		const chordPosition = lyricPosition + chordOffset;

		markers.push( {
			chord,
			chordPosition,
			lyricPosition: baseLyricPosition,
			lyricSegmentLength: segmentLength,
		} );
		segments.push( { chord, lyric } );
		lyricText += lyric;

		if ( segmentLength > 0 ) {
			lyricPosition += segmentLength;
			chordOffset = 0;
		} else {
			chordOffset += chordLength + 1;
		}
	}

	return {
		type: 'chord_line',
		lyricText,
		accessibleText: buildAccessibleChordLine( leadingText, segments ),
		markers,
		hasTransposableChord: markers.some( ( marker ) =>
			isTransposableChord( marker.chord )
		),
	};
}

function createEmptyDocument() {
	return {
		meta: {
			title: '',
			subtitle: '',
			artist: '',
			composer: '',
			lyricist: '',
			key: '',
			lyrics: '',
		},
		features: {
			hasChords: false,
			hasTransposableChords: false,
		},
		nodes: [],
	};
}

function assignMetaValue( document, key, value ) {
	const metaKey = {
		title: 'title',
		t: 'title',
		subtitle: 'subtitle',
		st: 'subtitle',
		artist: 'artist',
		composer: 'composer',
		lyricist: 'lyricist',
		key: 'key',
	}[ key ];

	if ( ! metaKey || document.meta[ metaKey ] ) {
		return;
	}

	document.meta[ metaKey ] = value;
}

function flushTopMatter( parserState ) {
	if ( parserState.topMatterFlushed ) {
		return;
	}

	parserState.topMatterFlushed = true;

	if ( parserState.pendingTopMatter.length === 0 ) {
		return;
	}

	parserState.document.nodes.push( {
		type: 'top_matter',
		items: [ ...parserState.pendingTopMatter ],
	} );
}

function getSectionType( key ) {
	switch ( key ) {
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

function isSectionEndKey( key ) {
	return [
		'end_of_chorus',
		'eoc',
		'end_of_verse',
		'eov',
		'end_of_bridge',
		'eob',
	].includes( key );
}

function createDirectiveNode( key, value ) {
	switch ( key ) {
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
			return {
				type: 'directive',
				key,
				value,
			};
		case 'comment':
		case 'c':
			return {
				type: 'comment',
				variant: 'comment',
				value,
			};
		case 'chorus':
		case 'verse':
		case 'bridge':
			return {
				type: 'comment',
				variant: key,
				value: '',
			};
		default:
			return null;
	}
}

export function getChordProLabels() {
	return {
		verse: __( 'Verse', 'chordpro-block' ),
		chorus: __( 'Chorus', 'chordpro-block' ),
		bridge: __( 'Bridge', 'chordpro-block' ),
		keyLabel: _x( 'Key', 'musical key label', 'chordpro-block' ),
		capoLabel: _x( 'Capo', 'guitar capo position', 'chordpro-block' ),
		tempo: __( 'Tempo', 'chordpro-block' ),
		time: __( 'Time', 'chordpro-block' ),
		duration: __( 'Duration', 'chordpro-block' ),
		transpose: __( 'Transpose', 'chordpro-block' ),
		transposeChords: __( 'Transpose chords', 'chordpro-block' ),
		lowerSemitone: __( 'Lower one semitone', 'chordpro-block' ),
		raiseSemitone: __( 'Raise one semitone', 'chordpro-block' ),
		reset: __( 'Reset', 'chordpro-block' ),
		transposeOffset: __( 'Transpose offset 0 semitones', 'chordpro-block' ),
	};
}

export function translateSectionLabelPrefix(
	value,
	labels = getChordProLabels()
) {
	const match = value.match( /^(verse|chorus|bridge)(\b.*)$/i );

	if ( ! match ) {
		return value;
	}

	const translated = labels[ match[ 1 ].toLowerCase() ];

	if ( ! translated ) {
		return value;
	}

	return `${ translated }${ match[ 2 ] }`;
}

export function createChordProDocument( text ) {
	const lines = String( text || '' ).split( '\n' );
	const document = createEmptyDocument();
	const lyricsLines = [];
	const parserState = {
		document,
		pendingTopMatter: [],
		topMatterFlushed: false,
		sectionStack: [],
	};

	for ( let index = 0; index < lines.length; index++ ) {
		const line = lines[ index ].replace( /\s+$/, '' );
		const structuralDirective = extractStructuralDirective( line );

		if ( structuralDirective ) {
			const { key, value } = getDirectiveParts( structuralDirective );

			if ( [ 'start_of_tab', 'sot' ].includes( key ) ) {
				flushTopMatter( parserState );

				const tabLines = [];

				for (
					let cursor = index + 1;
					cursor < lines.length;
					cursor++
				) {
					const tabLine = lines[ cursor ].replace( /\s+$/, '' );
					const maybeEndDirective =
						extractStructuralDirective( tabLine );

					if ( maybeEndDirective ) {
						const endDirectiveParts =
							getDirectiveParts( maybeEndDirective );

						if (
							[ 'end_of_tab', 'eot' ].includes(
								endDirectiveParts.key
							)
						) {
							index = cursor;
							break;
						}
					}

					tabLines.push( tabLine );

					if ( cursor === lines.length - 1 ) {
						index = cursor;
					}
				}

				document.nodes.push( {
					type: 'tab_block',
					lines: tabLines,
				} );
				continue;
			}

			const sectionType = getSectionType( key );

			if ( sectionType ) {
				flushTopMatter( parserState );
				parserState.sectionStack.push( sectionType );
				document.nodes.push( {
					type: 'section_start',
					sectionType,
					label: value,
				} );
				continue;
			}

			if ( isSectionEndKey( key ) ) {
				flushTopMatter( parserState );

				if ( parserState.sectionStack.length > 0 ) {
					document.nodes.push( {
						type: 'section_end',
						sectionType: parserState.sectionStack.pop(),
					} );
				}
				continue;
			}
		}

		const directiveMatch = line.trim().match( DIRECTIVE_LINE_RE );

		if ( directiveMatch ) {
			const { key, value } = getDirectiveParts( directiveMatch[ 1 ] );

			assignMetaValue( document, key, value );

			if (
				! parserState.topMatterFlushed &&
				isTopMatterDirectiveKey( key )
			) {
				parserState.pendingTopMatter.push( {
					key,
					value,
					canonicalKey: normalizeTopMatterKey( key ),
					priority: getTopMatterPriority( key ),
					group: isMetaRowDirectiveKey( key )
						? 'meta_row'
						: 'default',
					order: parserState.pendingTopMatter.length,
				} );
				continue;
			}

			flushTopMatter( parserState );

			const directiveNode = createDirectiveNode( key, value );

			if ( directiveNode ) {
				document.nodes.push( directiveNode );
			}

			continue;
		}

		if ( line.trim() === '' ) {
			flushTopMatter( parserState );
			document.nodes.push( {
				type: 'spacer',
			} );
			lyricsLines.push( '' );
			continue;
		}

		if ( hasChordTokens( line ) ) {
			flushTopMatter( parserState );

			const chordLine = parseChordLine( line );

			document.features.hasChords = true;
			document.features.hasTransposableChords =
				document.features.hasTransposableChords ||
				chordLine.hasTransposableChord;
			document.nodes.push( chordLine );
			lyricsLines.push( chordLine.lyricText );
			continue;
		}

		flushTopMatter( parserState );
		document.nodes.push( {
			type: 'lyric_line',
			text: line,
		} );
		lyricsLines.push( line );
	}

	flushTopMatter( parserState );

	while ( parserState.sectionStack.length > 0 ) {
		document.nodes.push( {
			type: 'section_end',
			sectionType: parserState.sectionStack.pop(),
		} );
	}

	document.meta.lyrics = lyricsLines.join( '\n' ).trim();

	return document;
}

function renderTransposeControlsMarkup( labels ) {
	return `<div class="chordpro-transpose-controls" role="group" aria-label="${ escapeHtml(
		labels.transposeChords
	) }"><strong class="chordpro-meta-label">${ escapeHtml(
		labels.transpose
	) }:</strong><button type="button" class="chordpro-transpose-button" data-transpose-change="-1" aria-label="${ escapeHtml(
		labels.lowerSemitone
	) }">-</button><button type="button" class="chordpro-transpose-button" data-transpose-change="1" aria-label="${ escapeHtml(
		labels.raiseSemitone
	) }">+</button><button type="button" class="chordpro-transpose-reset" data-transpose-reset disabled>${ escapeHtml(
		labels.reset
	) }</button><span class="chordpro-transpose-value" data-transpose-display aria-live="polite" aria-atomic="true">${ escapeHtml(
		'0'
	) }</span></div>`;
}

function renderDirectiveNode( node, options, labels ) {
	switch ( node.key ) {
		case 'title':
		case 't':
			if ( ! options.showTitle ) {
				return '';
			}
			return `<div class="chordpro-title">${ escapeHtml(
				node.value
			) }</div>`;
		case 'subtitle':
		case 'st':
			return `<div class="chordpro-subtitle">${ escapeHtml(
				node.value
			) }</div>`;
		case 'artist':
			if ( ! options.showArtist ) {
				return '';
			}
			return `<div class="chordpro-artist">${ escapeHtml(
				node.value
			) }</div>`;
		case 'composer':
			return `<div class="chordpro-composer">${ escapeHtml(
				node.value
			) }</div>`;
		case 'lyricist':
			return `<div class="chordpro-lyricist">${ escapeHtml(
				node.value
			) }</div>`;
		case 'key':
			return `<div class="chordpro-meta"><strong class="chordpro-meta-label">${ escapeHtml(
				labels.keyLabel
			) }:</strong><span class="chordpro-meta-value" data-original-key="${ escapeHtml(
				node.value
			) }">${ escapeHtml( node.value ) }</span></div>`;
		case 'capo':
			return `<div class="chordpro-meta"><strong class="chordpro-meta-label">${ escapeHtml(
				labels.capoLabel
			) }:</strong><span class="chordpro-meta-value">${ escapeHtml(
				node.value
			) }</span></div>`;
		case 'tempo':
			return `<div class="chordpro-meta"><strong class="chordpro-meta-label">${ escapeHtml(
				labels.tempo
			) }:</strong><span class="chordpro-meta-value">${ escapeHtml(
				node.value
			) }</span></div>`;
		case 'time':
			return `<div class="chordpro-meta"><strong class="chordpro-meta-label">${ escapeHtml(
				labels.time
			) }:</strong><span class="chordpro-meta-value">${ escapeHtml(
				node.value
			) }</span></div>`;
		case 'duration':
			return `<div class="chordpro-meta"><strong class="chordpro-meta-label">${ escapeHtml(
				labels.duration
			) }:</strong><span class="chordpro-meta-value">${ escapeHtml(
				node.value
			) }</span></div>`;
		default:
			return '';
	}
}

function renderTopMatterNode( node, state, options, labels ) {
	const items = [ ...node.items ].sort(
		( first, second ) =>
			first.priority - second.priority || first.order - second.order
	);
	let html = '';
	const metaRowItems = [];

	items.forEach( ( item ) => {
		const rendered = renderDirectiveNode(
			{
				type: 'directive',
				key: item.key,
				value: item.value,
			},
			options,
			labels
		);

		if ( ! rendered ) {
			return;
		}

		if ( item.group === 'meta_row' ) {
			metaRowItems.push( rendered );
			return;
		}

		html += rendered;
	} );

	if ( metaRowItems.length ) {
		html += `<div class="chordpro-meta-bar">${ metaRowItems.join(
			''
		) }</div>`;

		if ( options.includeControls && ! state.controlsRendered ) {
			html += `<div class="chordpro-transpose-row">${ renderTransposeControlsMarkup(
				labels
			) }</div>`;
			state.controlsRendered = true;
		}
	}

	return html;
}

function renderCommentNode( node, labels ) {
	if ( node.variant === 'comment' ) {
		return `<div class="chordpro-comment">${ escapeHtml(
			translateSectionLabelPrefix( node.value, labels )
		) }</div>`;
	}

	return `<div class="chordpro-comment">${ escapeHtml(
		labels[ node.variant ]
	) }</div>`;
}

function renderChordLineNode( node ) {
	const chordMarkers = node.markers
		.map(
			( marker ) =>
				`<p class="chordpro-chord" data-original-chord="${ escapeHtml(
					marker.chord
				) }" data-lyric-position="${
					marker.lyricPosition
				}" data-lyric-segment-length="${
					marker.lyricSegmentLength
				}" style="left:${ marker.chordPosition }ch">${ escapeHtml(
					marker.chord
				) }</p>`
		)
		.join( '' );

	return `<div class="chordpro-line chordpro-line-annotated"><span class="chordpro-accessible-line">${ escapeHtml(
		node.accessibleText || node.lyricText
	) }</span><div class="chordpro-chords" aria-hidden="true">${ chordMarkers }</div><p class="chordpro-lyric chordpro-lyric-full" aria-hidden="true">${ escapeHtml(
		node.lyricText
	) }</p></div>`;
}

export function renderChordProDocument( document, options = {} ) {
	const renderOptions = {
		showTitle: options.showTitle ?? true,
		showArtist: options.showArtist ?? true,
		includeControls:
			options.includeControls ?? document.features.hasTransposableChords,
	};
	const labels = options.labels || getChordProLabels();
	const state = {
		controlsRendered: false,
		openSections: 0,
	};
	let html = '';

	document.nodes.forEach( ( node ) => {
		switch ( node.type ) {
			case 'top_matter':
				html += renderTopMatterNode(
					node,
					state,
					renderOptions,
					labels
				);
				break;
			case 'directive':
				html += renderDirectiveNode( node, renderOptions, labels );
				break;
			case 'comment':
				html += renderCommentNode( node, labels );
				break;
			case 'section_start': {
				const sectionLabel = node.label
					? `<div class="chordpro-section-label">${ escapeHtml(
							translateSectionLabelPrefix( node.label, labels )
					  ) }</div>`
					: '';

				html += `<div class="chordpro-section chordpro-${ escapeHtml(
					node.sectionType
				) }">${ sectionLabel }`;
				state.openSections += 1;
				break;
			}
			case 'section_end':
				if ( state.openSections > 0 ) {
					html += '</div>';
					state.openSections -= 1;
				}
				break;
			case 'tab_block':
				html += `<pre class="chordpro-tab">${ escapeHtml(
					node.lines.join( '\n' )
				) }</pre>`;
				break;
			case 'spacer':
				html += '<div class="chordpro-spacer"></div>';
				break;
			case 'lyric_line':
				html += `<div class="chordpro-line"><p class="chordpro-lyric chordpro-lyric-plain">${ escapeHtml(
					node.text
				) }</p></div>`;
				break;
			case 'chord_line':
				html += renderChordLineNode( node );
				break;
		}
	} );

	while ( state.openSections > 0 ) {
		html += '</div>';
		state.openSections -= 1;
	}

	if (
		renderOptions.includeControls &&
		document.features.hasTransposableChords &&
		! state.controlsRendered
	) {
		html = renderTransposeControlsMarkup( labels ) + html;
	}

	return html;
}

export function parseChordPro( text, options = {} ) {
	return renderChordProDocument( createChordProDocument( text ), {
		...options,
		includeControls: false,
	} );
}
