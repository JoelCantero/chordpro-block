import { __, _x } from '@wordpress/i18n';

export function getGeneratedChordProLabels() {
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
		songLyricsDefault: __( 'Song Lyrics', 'chordpro-block' ),
	};
}
