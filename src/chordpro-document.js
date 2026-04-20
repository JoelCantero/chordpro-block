import {
	getChordProSpec,
	getChordTokenRegExp,
	getDirectiveLineRegExp,
	getSectionLabelPrefixRegExp,
	getStructuralDirectiveRegExp,
} from './chordpro-spec';
import { isTransposableChord } from './chordpro-transpose';
import { getGeneratedChordProLabels } from './generated/chordpro-labels';

const SPEC = getChordProSpec();
const NODE_TYPES = SPEC.document.nodeTypes;
const STRUCTURAL_DIRECTIVE_RE = getStructuralDirectiveRegExp( SPEC );
const DIRECTIVE_LINE_RE = getDirectiveLineRegExp( SPEC );
const CHORD_TOKEN_RE = getChordTokenRegExp( SPEC );
const SECTION_LABEL_PREFIX_RE = getSectionLabelPrefixRegExp( SPEC );

function escapeHtml( text ) {
	return String( text )
		.replace( /&/g, '&amp;' )
		.replace( /</g, '&lt;' )
		.replace( />/g, '&gt;' )
		.replace( /"/g, '&quot;' )
		.replace( /'/g, '&#039;' );
}

function getTopMatterItem( key ) {
	return SPEC.topMatter.items[ key ] || null;
}

function getDirectiveNodeConfig( key ) {
	return SPEC.directiveNodes[ key ] || null;
}

function getDirectiveRenderConfig( key ) {
	return SPEC.render.directiveNodes[ key ] || null;
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
	return getTopMatterItem( key )?.canonicalKey || key;
}

function isTopMatterDirectiveKey( key ) {
	return !! getTopMatterItem( key );
}

function isMetaRowDirectiveKey( key ) {
	return getTopMatterItem( key )?.group === 'meta_row';
}

function getTopMatterPriority( key ) {
	return getTopMatterItem( key )?.priority ?? 100;
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
		type: NODE_TYPES.chordLine,
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
		meta: { ...SPEC.document.metaDefaults },
		features: { ...SPEC.document.featureDefaults },
		nodes: [],
	};
}

function assignMetaValue( document, key, value ) {
	const metaKey = getTopMatterItem( key )?.metaKey;

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
		type: NODE_TYPES.topMatter,
		items: [ ...parserState.pendingTopMatter ],
	} );
}

function getSectionType( key ) {
	return SPEC.structuralDirectives.sectionStarts[ key ] || null;
}

function isSectionEndKey( key ) {
	return SPEC.structuralDirectives.sectionEnds.includes( key );
}

function isTabStartKey( key ) {
	return SPEC.structuralDirectives.tabs.starts.includes( key );
}

function isTabEndKey( key ) {
	return SPEC.structuralDirectives.tabs.ends.includes( key );
}

function createDirectiveNode( key, value ) {
	const config = getDirectiveNodeConfig( key );

	if ( ! config ) {
		return null;
	}

	if ( config.type === NODE_TYPES.directive ) {
		return {
			type: NODE_TYPES.directive,
			key,
			value,
		};
	}

	return {
		type: NODE_TYPES.comment,
		variant: config.variant,
		value: config.includeValue === false ? '' : value,
	};
}

export function getChordProLabels() {
	return getGeneratedChordProLabels();
}

export function translateSectionLabelPrefix(
	value,
	labels = getChordProLabels()
) {
	const match = value.match( SECTION_LABEL_PREFIX_RE );

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

			if ( isTabStartKey( key ) ) {
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

						if ( isTabEndKey( endDirectiveParts.key ) ) {
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
					type: NODE_TYPES.tabBlock,
					lines: tabLines,
				} );
				continue;
			}

			const sectionType = getSectionType( key );

			if ( sectionType ) {
				flushTopMatter( parserState );
				parserState.sectionStack.push( sectionType );
				document.nodes.push( {
					type: NODE_TYPES.sectionStart,
					sectionType,
					label: value,
				} );
				continue;
			}

			if ( isSectionEndKey( key ) ) {
				flushTopMatter( parserState );

				if ( parserState.sectionStack.length > 0 ) {
					document.nodes.push( {
						type: NODE_TYPES.sectionEnd,
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
				type: NODE_TYPES.spacer,
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
			type: NODE_TYPES.lyricLine,
			text: line,
		} );
		lyricsLines.push( line );
	}

	flushTopMatter( parserState );

	while ( parserState.sectionStack.length > 0 ) {
		document.nodes.push( {
			type: NODE_TYPES.sectionEnd,
			sectionType: parserState.sectionStack.pop(),
		} );
	}

	document.meta.lyrics = lyricsLines.join( '\n' ).trim();

	return document;
}

function renderTransposeControlsMarkup( labels ) {
	const config = SPEC.render.transposeControls;
	const buttons = config.buttons
		.map( ( button ) => {
			const attributes = [
				'type="button"',
				`class="${ escapeHtml( button.className ) }"`,
			];

			if ( button.kind === 'change' ) {
				attributes.push(
					`data-transpose-change="${ escapeHtml( button.value ) }"`
				);
			} else if ( button.kind === 'reset' ) {
				attributes.push( 'data-transpose-reset' );
			}

			if ( button.disabled ) {
				attributes.push( 'disabled' );
			}

			attributes.push(
				`aria-label="${ escapeHtml( labels[ button.labelKey ] ) }"`
			);

			const labelText = button.textLabelKey
				? labels[ button.textLabelKey ]
				: button.text;

			return `<button ${ attributes.join( ' ' ) }>${ escapeHtml(
				labelText
			) }</button>`;
		} )
		.join( '' );
	const display = config.display;

	return `<div class="chordpro-transpose-controls" role="group" aria-label="${ escapeHtml(
		labels[ config.groupLabelKey ]
	) }"><strong class="chordpro-meta-label">${ escapeHtml(
		labels[ config.titleLabelKey ]
	) }:</strong>${ buttons }<span class="${ escapeHtml(
		display.className
	) }" data-transpose-display aria-live="${ escapeHtml(
		display.ariaLive
	) }" aria-atomic="${ escapeHtml( display.ariaAtomic ) }">${ escapeHtml(
		display.initialValue
	) }</span></div>`;
}

function renderDirectiveNode( node, options, labels ) {
	const config = getDirectiveRenderConfig( node.key );

	if ( ! config ) {
		return '';
	}

	if ( config.option && ! options[ config.option ] ) {
		return '';
	}

	if ( config.kind === 'text' ) {
		return `<div class="${ escapeHtml( config.className ) }">${ escapeHtml(
			node.value
		) }</div>`;
	}

	if ( config.kind === 'meta' ) {
		const dataAttribute = config.dataAttribute
			? ` ${ config.dataAttribute }="${ escapeHtml( node.value ) }"`
			: '';

		return `<div class="chordpro-meta"><strong class="chordpro-meta-label">${ escapeHtml(
			labels[ config.labelKey ]
		) }:</strong><span class="chordpro-meta-value"${ dataAttribute }>${ escapeHtml(
			node.value
		) }</span></div>`;
	}

	return '';
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
				type: NODE_TYPES.directive,
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
			case NODE_TYPES.topMatter:
				html += renderTopMatterNode(
					node,
					state,
					renderOptions,
					labels
				);
				break;
			case NODE_TYPES.directive:
				html += renderDirectiveNode( node, renderOptions, labels );
				break;
			case NODE_TYPES.comment:
				html += renderCommentNode( node, labels );
				break;
			case NODE_TYPES.sectionStart: {
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
			case NODE_TYPES.sectionEnd:
				if ( state.openSections > 0 ) {
					html += '</div>';
					state.openSections -= 1;
				}
				break;
			case NODE_TYPES.tabBlock:
				html += `<pre class="chordpro-tab">${ escapeHtml(
					node.lines.join( '\n' )
				) }</pre>`;
				break;
			case NODE_TYPES.spacer:
				html += '<div class="chordpro-spacer"></div>';
				break;
			case NODE_TYPES.lyricLine:
				html += `<div class="chordpro-line"><p class="chordpro-lyric chordpro-lyric-plain">${ escapeHtml(
					node.text
				) }</p></div>`;
				break;
			case NODE_TYPES.chordLine:
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
