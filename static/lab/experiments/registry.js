/* Systemblue Lab — experiment registry.
   To add a piece: append an entry here and drop its module in /experiments.
   An entry without `module` opens the shared placeholder.
   The gallery lists only status:'live' entries; set SBL.showUpcoming = true to list the rest.
   sound:true lets the shell open audio on the launch click and show the mute control.
   motif: organism | matter | rooms | sonic | compose | fluid | type | physics | audio | cloud | melt | murmur | lines */
SBL.experiments = [
  { id:'01', title:'Particle Organism', blurb:'A swarm that reads how you move, not just where.', tech:['Three.js','WebGL','Web Audio','Custom physics'], motif:'organism', status:'live', sound:true,
    module:'experiments/01-particle-organism.js',
    libs:['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js','experiments/01-sound.js'] },
  { id:'02', title:'Palimpsest',      blurb:'Draw, erase, draw again. The surface forgets. The field underneath does not.', tech:['Canvas 2D','Vector field','Pointer sampling','IndexedDB','Web Audio'], motif:'palimpsest', status:'live', sound:true, module:'experiments/02-palimpsest.js', libs:['experiments/02-sound.js'] },
  { id:'03', title:'Sonic Architecture', blurb:'Music builds a city. Bass lays the foundations, highs add the detail.', tech:['Web Audio','Three.js','FFT analysis'], motif:'sonic', status:'live', sound:true,
    module:'experiments/03-sonic-architecture.js',
    libs:['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js','experiments/03-sound.js'] },
  { id:'04', title:'Infinite Composition', blurb:'Every click composes a new arrangement. It plays what it draws.', tech:['p5.js','SVG','Seeded randomness','Web Audio'], motif:'compose', status:'live', sound:true,
    module:'experiments/04-infinite-composition.js',
    libs:['https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.4/p5.min.js','experiments/04-sound.js'] },
  { id:'05', title:'Resonant Matter', blurb:'Drum & bass builds a sculpture. Every kick adds mass, every snare cracks it.', tech:['Web Audio','FFT onset detection','Three.js'], motif:'matter', status:'live', sound:true,
    module:'experiments/05-resonant-matter.js',
    libs:['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js','experiments/05-sound.js'] },
  { id:'06', title:'The Room That Remembers', blurb:'Eight rooms that rearrange themselves around your habits.', tech:['Three.js','Graph navigation','Web Audio'], motif:'rooms', status:'live', sound:true,
    module:'experiments/06-room-that-remembers.js',
    libs:['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js','experiments/06-sound.js'] },
  { id:'07', title:'The Negotiation', blurb:'You draw. It redraws. Every correction teaches it something, not always what you meant.', tech:['Pointer input','Gesture classification','Procedural SVG','Seeded randomness','Web Audio'], motif:'negotiate', status:'live', sound:true, module:'experiments/07-negotiation.js', libs:['experiments/07-sound.js'] },
  { id:'08', title:'The Unreliable Alphabet', blurb:'Words that move against their meaning. The closer you read, the less they say.', tech:['Variable fonts','SVG filters','GSAP','Canvas particles','Web Audio'], motif:'unreliable', status:'live', sound:true, module:'experiments/08-unreliable-alphabet.js', libs:['https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js','experiments/08-sound.js'] },
  { id:'09', title:'The Collective',  blurb:'Thousands of agents with their own ideas. Push too hard and they split; leave them alone and they find each other.', tech:['Canvas 2D','Boids','Spatial hashing','Web Audio'], motif:'collective', status:'live', sound:true, module:'experiments/09-collective.js', libs:['experiments/09-sound.js'] },
  { id:'10', title:'Gravity Toys',    blurb:'A desk of objects that refuse to sit still.',   tech:['Matter.js'],              motif:'physics', status:'soon' },
  { id:'11', title:'Line Weather',    blurb:'Drawings that change with an invisible wind.',  tech:['p5.js'],                  motif:'lines',   status:'soon' },
  { id:'12', title:'Point Cathedral', blurb:'Architecture built from two million dots.',     tech:['Three.js'],               motif:'cloud',   status:'soon' },
  { id:'13', title:'Tone Garden',     blurb:'Plant a sound. It grows into the next one.',    tech:['Web Audio','p5.js'],      motif:'audio',   status:'soon' },
  { id:'14', title:'Mirror Melt',     blurb:'An image that gives way under your hand.',      tech:['GLSL'],                   motif:'melt',    status:'soon' },
  { id:'15', title:'Ink Tide',        blurb:'Fluid that remembers every stroke.',            tech:['WebGL','GLSL'],           motif:'fluid',   status:'soon' }
];
