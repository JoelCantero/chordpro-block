import rawSpec from './chordpro-spec.json';

function escapeRegExp( value ) {
	return value.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
}

function sortLongestFirst( values ) {
	return [ ...values ].sort(
		( first, second ) => second.length - first.length
	);
}

function getStructuralDirectiveKeys( spec ) {
	return sortLongestFirst( [
		...Object.keys( spec.structuralDirectives.sectionStarts ),
		...spec.structuralDirectives.sectionEnds,
		...spec.structuralDirectives.tabs.starts,
		...spec.structuralDirectives.tabs.ends,
	] );
}

export function getChordProSpec() {
	return rawSpec;
}

export function getStructuralDirectiveRegExp( spec = rawSpec ) {
	const keys = getStructuralDirectiveKeys( spec )
		.map( escapeRegExp )
		.join( '|' );

	return new RegExp(
		`^[{\\[]\\s*((${ keys })(?:\\s*:\\s*[^}\\]]*)?)\\s*[}\\]]$`,
		'i'
	);
}

export function getDirectiveLineRegExp( spec = rawSpec ) {
	return new RegExp( spec.patterns.directiveLine );
}

export function getChordTokenRegExp( spec = rawSpec ) {
	return new RegExp( spec.patterns.chordToken, 'u' );
}

export function getSectionLabelPrefixRegExp( spec = rawSpec ) {
	const variants = sortLongestFirst( spec.render.sectionLabelVariants || [] )
		.map( escapeRegExp )
		.join( '|' );

	return new RegExp( `^(${ variants })(\\b.*)$`, 'i' );
}
