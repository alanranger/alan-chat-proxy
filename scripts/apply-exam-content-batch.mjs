/**
 * Apply Claude exam-content batch (2026-06-10) to canonical + mirror JSON.
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = 'G:/Dropbox/alan ranger photography/Website Code/Academy/alanranger-academy-assesment';
const CANON = join(ROOT, 'alanranger-modules/modules');
const MIRROR = join(ROOT, 'modules');

const EDITS = {
  'module-01-exposure.json': {
    6: {
      question: 'Which file format gives you the most flexibility to correct exposure afterwards?',
      options: ['RAW', 'JPEG', 'PNG', 'GIF'],
      correct: 0,
      reviewHint: 'RAW preserves all the sensor data, giving the most latitude to fix exposure in editing.'
    },
    9: {
      question: 'To get a blurred background (shallow depth of field), which should you choose?',
      options: [
        'A wide aperture / low f-number (e.g. f/2.8)',
        'A narrow aperture / high f-number (e.g. f/16)',
        'A faster shutter speed',
        'A lower ISO'
      ],
      correct: 0,
      reviewHint: 'Wide aperture (low f-number) = shallow depth of field = blurred background.'
    }
  },
  'module-02-aperture.json': {
    8: {
      question: 'At the same f-stop, how does a longer focal length (e.g. 100mm vs 50mm) affect depth of field?',
      options: [
        'It makes depth of field shallower (more background blur)',
        'It makes depth of field deeper (more in focus)',
        'It has no effect on depth of field',
        'It only changes exposure, not depth of field'
      ],
      correct: 0,
      reviewHint: 'At the same aperture, a longer focal length gives a shallower depth of field and more background blur.'
    },
    9: {
      question: 'Why should you avoid using the smallest apertures (f/22–f/32) unless necessary?',
      options: [
        'Diffraction can soften image detail',
        'They make the background more blurred',
        'They always overexpose the image',
        'They disable autofocus'
      ],
      correct: 0,
      reviewHint: 'Very small apertures (f/22–f/32) can cause diffraction, which softens fine detail.'
    },
    11: {
      question: 'Which mode lets you set the aperture while the camera sets the shutter speed?',
      options: ['Aperture Priority (A/Av)', 'Shutter Priority (S/Tv)', 'Program (P)', 'Manual (M)'],
      correct: 0,
      reviewHint: 'Aperture Priority (A/Av): you pick the aperture, the camera sets the shutter speed.'
    }
  },
  'module-03-shutter.json': {
    4: {
      question: 'To capture a silky waterfall with smooth, blurred water, which shutter speed range works best?',
      options: ['1/4 – 2 seconds', '1/1000s', '1/250s', '1/60s'],
      correct: 0,
      reviewHint: 'Silky water needs a slow shutter — the guide suggests roughly 1/4–2 seconds (use a tripod).'
    },
    6: {
      question: 'Which shutter speed is best for a sharp photo of someone running?',
      options: ['1/125', '1/250', '1/500', '1/1000'],
      correct: 3,
      reviewHint: 'Fast motion like running needs a fast shutter — around 1/1000s (the page lists sport at 1/1000–1/2000s).'
    },
    10: {
      question: 'What rule does the guide recommend for the slowest handheld shutter speed to avoid camera shake?',
      options: [
        'At least 1 / (2 × the lens focal length)',
        'Always 1/60s regardless of lens',
        'The same number as your ISO',
        'Twice the aperture f-number'
      ],
      correct: 0,
      reviewHint: 'The guide\'s handheld rule is to start at 1/(2× focal length) — e.g. ~1/100s for a 50mm lens.'
    }
  },
  'module-04-iso.json': {
    0: {
      question: 'What does ISO control in your photos?',
      options: [
        'The lens opening (aperture)',
        'How long the shutter stays open',
        'How bright or dark the image is — the sensor\'s sensitivity to light',
        'The white balance / colour temperature'
      ],
      correct: 2,
      reviewHint: 'ISO sets the sensor\'s sensitivity to light — it brightens or darkens the image.'
    },
    7: {
      question: 'Why is base ISO (around 100) preferred when there is plenty of light?',
      options: [
        'It produces the cleanest image with the least noise',
        'It blurs the background more',
        'It makes the shutter faster automatically',
        'It changes the white balance'
      ],
      correct: 0,
      reviewHint: 'Base ISO (≈100) gives the highest image quality with minimal noise — use it when light allows.'
    },
    9: {
      question: 'In bright daylight, which ISO does the guide suggest starting at?',
      options: ['ISO 100–200', 'ISO 1600', 'ISO 6400', 'ISO 12,800'],
      correct: 0,
      reviewHint: 'In bright daylight use a low ISO (100–200) for the cleanest files.'
    }
  },
  'module-05-manual.json': {
    3: {
      question: 'When shooting a series in Manual, what keeps your exposures consistent shot to shot?',
      options: [
        'Lock your settings and change only one variable at a time',
        'Let the camera re-meter and adjust each frame',
        'Use a different aperture for every shot',
        'Judge exposure from the LCD brightness each time'
      ],
      correct: 0,
      reviewHint: 'Manual\'s big advantage: lock the look and change only one variable at a time so a whole series matches.'
    },
    11: {
      question: 'What setting order does the guide recommend in Manual mode?',
      options: [
        'Aperture for depth → shutter for motion → ISO to meet the meter',
        'ISO first → then aperture → then shutter',
        'Shutter first → then white balance → then aperture',
        'Set white balance first, then exposure'
      ],
      correct: 0,
      reviewHint: 'The guide\'s workflow: 1) aperture for depth, 2) shutter for motion, 3) ISO to meet the meter.'
    }
  },
  'module-08-focusing.json': {
    2: {
      question: 'Which three factors affect depth of field?',
      options: [
        'Aperture, subject distance, and focal length',
        'ISO, white balance, and shutter speed',
        'Autofocus mode, metering, and file format',
        'Lens coating, sensor size, and battery level'
      ],
      correct: 0,
      reviewHint: 'Depth of field is controlled by aperture, how far the subject is, and the lens focal length.'
    },
    11: {
      question: 'At a wide aperture like f/1.8, instead of focus-and-recompose you should…',
      options: [
        'Move the AF point onto the subject (or use eye detect)',
        'Always use the centre point and recompose',
        'Switch to the smallest aperture first',
        'Turn autofocus off and guess the distance'
      ],
      correct: 0,
      reviewHint: 'At shallow depth of field, moving the camera shifts focus — move the AF point to the subject instead.'
    }
  },
  'module-09-dof.json': {
    5: {
      question: 'For a landscape with a foreground rock and distant mountains, what keeps most of the scene sharp?',
      options: [
        'Use a small aperture (f/8–f/11) and focus into the scene, not just on the nearest rock',
        'Use f/2 and focus on the mountains',
        'Use the longest focal length you have',
        'Focus only on the closest rock at f/2'
      ],
      correct: 0,
      reviewHint: 'Deep landscapes need a small aperture (f/8–f/11) plus sensible focus placement — focus into the scene, beyond the nearest detail, not on the rock alone.'
    }
  },
  'module-10-drange.json': {
    2: {
      question: 'To minimise noise in the shadows of a high dynamic range scene, you should shoot at…',
      options: [
        'Base ISO (the camera\'s lowest native ISO)',
        'The highest ISO available',
        'Whatever ISO Auto picks',
        'A very small aperture like f/22'
      ],
      correct: 0,
      reviewHint: 'Shoot at base ISO to keep shadow noise low, which protects detail in the darkest tones.'
    },
    9: {
      question: 'Roughly how does the human eye\'s dynamic range compare with a typical camera\'s?',
      options: [
        'The eye sees far more (~20 stops) than most cameras (~12–15 stops)',
        'They are about the same',
        'Cameras see far more than the eye',
        'Neither can be measured in stops'
      ],
      correct: 0,
      reviewHint: 'The human eye perceives roughly 20+ stops; most cameras capture about 12–15 — which is why high-contrast scenes are hard.'
    },
    10: {
      question: 'Dynamic range is measured in \'stops\'. One stop represents…',
      options: [
        'A doubling or halving of light',
        'A 10% change in brightness',
        'One f-number on the lens',
        'One ISO step only'
      ],
      correct: 0,
      reviewHint: 'Each stop is a doubling (or halving) of light; cameras capture a range of about 12–15 stops.'
    }
  }
};

function validateModule(data, file) {
  if (!data.questions || !Array.isArray(data.questions)) throw new Error(`${file}: missing questions array`);
  data.questions.forEach((q, i) => {
    if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`${file} Q${i + 1}: need question + 4 options`);
    }
    if (q.correct < 0 || q.correct > 3) throw new Error(`${file} Q${i + 1}: correct out of range`);
  });
}

const results = [];

for (const [file, replacements] of Object.entries(EDITS)) {
  const canonPath = join(CANON, file);
  const data = JSON.parse(readFileSync(canonPath, 'utf8'));
  for (const [idx, obj] of Object.entries(replacements)) {
    const i = Number(idx);
    data.questions[i] = obj;
  }
  validateModule(data, file);
  const out = JSON.stringify(data, null, 2) + '\n';
  writeFileSync(canonPath, out, 'utf8');
  writeFileSync(join(MIRROR, file), out, 'utf8');
  results.push({ file, replaced: Object.keys(replacements).map(Number) });
  console.log(`OK ${file} indices ${Object.keys(replacements).join(',')}`);
}

console.log(JSON.stringify(results, null, 2));
