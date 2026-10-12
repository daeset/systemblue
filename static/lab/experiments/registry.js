/* Systemblue Lab — experiment registry.
   To add a piece: append an entry here and drop its module in /experiments.
   An entry without `module` opens the shared placeholder.
   sound:true lets the shell open audio on the launch click and show the mute control.
   motif: organism | compose | fluid | type | physics | audio | cloud | melt | murmur | lines */
SBL.experiments = [
  { id:'01', title:'Particle Organism', blurb:'A swarm that reads how you move, not just where.', tech:['Three.js','WebGL','Web Audio','Custom physics'], motif:'organism', status:'live', sound:true,
    module:'experiments/01-particle-organism.js',
    libs:['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js','experiments/01-sound.js'] },
 // { id:'02', title:'Ink Tide',        blurb:'Fluid that remembers every stroke.',            tech:['WebGL','GLSL'],           motif:'fluid',   status:'soon' },
 // { id:'03', title:'Type Elastic',    blurb:'Letterforms with mass, spring and temper.',     tech:['GSAP'],                   motif:'type',    status:'soon' },
  { id:'04', title:'Infinite Composition', blurb:'Every click composes a new arrangement. It plays what it draws.', tech:['p5.js','SVG','Seeded randomness','Web Audio'], motif:'compose', status:'live', sound:true,
    module:'experiments/04-infinite-composition.js',
    libs:['https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.4/p5.min.js','experiments/04-sound.js'] },
  //{ id:'05', title:'Tone Garden',     blurb:'Plant a sound. It grows into the next one.',    tech:['Web Audio','p5.js'],      motif:'audio',   status:'soon' },
  //{ id:'06', title:'Point Cathedral', blurb:'Architecture built from two million dots.',     tech:['Three.js'],               motif:'cloud',   status:'soon' },
  //{ id:'07', title:'Mirror Melt',     blurb:'An image that gives way under your hand.',      tech:['GLSL'],                   motif:'melt',    status:'soon' },
  //{ id:'08', title:'Murmuration',     blurb:'A flock too large to count.',                   tech:['WebGPU'],                 motif:'murmur',  status:'soon' },
  //{ id:'09', title:'Line Weather',    blurb:'Drawings that change with an invisible wind.',  tech:['p5.js'],                  motif:'lines',   status:'soon' },
  //{ id:'10', title:'Gravity Toys',    blurb:'A desk of objects that refuse to sit still.',   tech:['Matter.js'],              motif:'physics', status:'soon' }
];
