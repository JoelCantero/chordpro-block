<?php

namespace ChordProBlock\Parser;

function get_chordpro_shared_spec() : array {
	static $spec = null;

	if ( null !== $spec ) {
		return $spec;
	}

	$spec = json_decode(
		<<<'JSON'
{
	"patterns": {
		"directiveLine": "^\\{([^}]+)\\}$",
		"chordToken": "\\[[^\\]]+\\]"
	},
	"document": {
		"metaDefaults": {
			"title": "",
			"subtitle": "",
			"artist": "",
			"composer": "",
			"lyricist": "",
			"key": "",
			"lyrics": ""
		},
		"featureDefaults": {
			"hasChords": false,
			"hasTransposableChords": false
		},
		"nodeTypes": {
			"topMatter": "top_matter",
			"directive": "directive",
			"comment": "comment",
			"sectionStart": "section_start",
			"sectionEnd": "section_end",
			"tabBlock": "tab_block",
			"spacer": "spacer",
			"lyricLine": "lyric_line",
			"chordLine": "chord_line"
		}
	},
	"labels": {
		"verse": {
			"text": "Verse",
			"function": "__"
		},
		"chorus": {
			"text": "Chorus",
			"function": "__"
		},
		"bridge": {
			"text": "Bridge",
			"function": "__"
		},
		"keyLabel": {
			"text": "Key",
			"function": "_x",
			"context": "musical key label"
		},
		"capoLabel": {
			"text": "Capo",
			"function": "_x",
			"context": "guitar capo position"
		},
		"tempo": {
			"text": "Tempo",
			"function": "__"
		},
		"time": {
			"text": "Time",
			"function": "__"
		},
		"duration": {
			"text": "Duration",
			"function": "__"
		},
		"transpose": {
			"text": "Transpose",
			"function": "__"
		},
		"transposeChords": {
			"text": "Transpose chords",
			"function": "__"
		},
		"lowerSemitone": {
			"text": "Lower one semitone",
			"function": "__"
		},
		"raiseSemitone": {
			"text": "Raise one semitone",
			"function": "__"
		},
		"reset": {
			"text": "Reset",
			"function": "__"
		},
		"transposeOffset": {
			"text": "Transpose offset 0 semitones",
			"function": "__"
		},
		"songLyricsDefault": {
			"text": "Song Lyrics",
			"function": "__"
		}
	},
	"topMatter": {
		"items": {
			"title": {
				"canonicalKey": "title",
				"priority": 0,
				"group": "default",
				"metaKey": "title"
			},
			"t": {
				"canonicalKey": "title",
				"priority": 0,
				"group": "default",
				"metaKey": "title"
			},
			"subtitle": {
				"canonicalKey": "subtitle",
				"priority": 1,
				"group": "default",
				"metaKey": "subtitle"
			},
			"st": {
				"canonicalKey": "subtitle",
				"priority": 1,
				"group": "default",
				"metaKey": "subtitle"
			},
			"artist": {
				"canonicalKey": "artist",
				"priority": 2,
				"group": "default",
				"metaKey": "artist"
			},
			"composer": {
				"canonicalKey": "composer",
				"priority": 3,
				"group": "default",
				"metaKey": "composer"
			},
			"lyricist": {
				"canonicalKey": "lyricist",
				"priority": 4,
				"group": "default",
				"metaKey": "lyricist"
			},
			"tempo": {
				"canonicalKey": "tempo",
				"priority": 5,
				"group": "meta_row"
			},
			"key": {
				"canonicalKey": "key",
				"priority": 6,
				"group": "meta_row",
				"metaKey": "key"
			},
			"capo": {
				"canonicalKey": "capo",
				"priority": 7,
				"group": "meta_row"
			},
			"time": {
				"canonicalKey": "time",
				"priority": 8,
				"group": "meta_row"
			},
			"duration": {
				"canonicalKey": "duration",
				"priority": 9,
				"group": "meta_row"
			}
		}
	},
	"structuralDirectives": {
		"sectionStarts": {
			"start_of_chorus": "chorus",
			"soc": "chorus",
			"start_of_verse": "verse",
			"sov": "verse",
			"start_of_bridge": "bridge",
			"sob": "bridge"
		},
		"sectionEnds": [
			"end_of_chorus",
			"eoc",
			"end_of_verse",
			"eov",
			"end_of_bridge",
			"eob"
		],
		"tabs": {
			"starts": [
				"start_of_tab",
				"sot"
			],
			"ends": [
				"end_of_tab",
				"eot"
			]
		}
	},
	"directiveNodes": {
		"title": {
			"type": "directive"
		},
		"t": {
			"type": "directive"
		},
		"subtitle": {
			"type": "directive"
		},
		"st": {
			"type": "directive"
		},
		"artist": {
			"type": "directive"
		},
		"composer": {
			"type": "directive"
		},
		"lyricist": {
			"type": "directive"
		},
		"tempo": {
			"type": "directive"
		},
		"key": {
			"type": "directive"
		},
		"capo": {
			"type": "directive"
		},
		"time": {
			"type": "directive"
		},
		"duration": {
			"type": "directive"
		},
		"comment": {
			"type": "comment",
			"variant": "comment",
			"includeValue": true
		},
		"c": {
			"type": "comment",
			"variant": "comment",
			"includeValue": true
		},
		"chorus": {
			"type": "comment",
			"variant": "chorus",
			"includeValue": false
		},
		"verse": {
			"type": "comment",
			"variant": "verse",
			"includeValue": false
		},
		"bridge": {
			"type": "comment",
			"variant": "bridge",
			"includeValue": false
		}
	},
	"render": {
		"directiveNodes": {
			"title": {
				"kind": "text",
				"className": "chordpro-title",
				"option": "showTitle"
			},
			"t": {
				"kind": "text",
				"className": "chordpro-title",
				"option": "showTitle"
			},
			"subtitle": {
				"kind": "text",
				"className": "chordpro-subtitle"
			},
			"st": {
				"kind": "text",
				"className": "chordpro-subtitle"
			},
			"artist": {
				"kind": "text",
				"className": "chordpro-artist",
				"option": "showArtist"
			},
			"composer": {
				"kind": "text",
				"className": "chordpro-composer"
			},
			"lyricist": {
				"kind": "text",
				"className": "chordpro-lyricist"
			},
			"key": {
				"kind": "meta",
				"labelKey": "keyLabel",
				"dataAttribute": "data-original-key"
			},
			"capo": {
				"kind": "meta",
				"labelKey": "capoLabel"
			},
			"tempo": {
				"kind": "meta",
				"labelKey": "tempo"
			},
			"time": {
				"kind": "meta",
				"labelKey": "time"
			},
			"duration": {
				"kind": "meta",
				"labelKey": "duration"
			}
		},
		"sectionLabelVariants": [
			"verse",
			"chorus",
			"bridge"
		],
		"transposeControls": {
			"groupLabelKey": "transposeChords",
			"titleLabelKey": "transpose",
			"buttons": [
				{
					"kind": "change",
					"value": "-1",
					"className": "chordpro-transpose-button",
					"labelKey": "lowerSemitone",
					"text": "-"
				},
				{
					"kind": "change",
					"value": "1",
					"className": "chordpro-transpose-button",
					"labelKey": "raiseSemitone",
					"text": "+"
				},
				{
					"kind": "reset",
					"className": "chordpro-transpose-reset",
					"labelKey": "reset",
					"textLabelKey": "reset",
					"disabled": true
				}
			],
			"display": {
				"className": "chordpro-transpose-value",
				"initialValue": "0",
				"ariaLive": "polite",
				"ariaAtomic": "true"
			}
		}
	}
}

JSON,
		true
	);

	if ( ! is_array( $spec ) ) {
		return array();
	}

	return $spec;
}
