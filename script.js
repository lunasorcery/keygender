// keygen
const tbxPronouns = document.getElementById('pronouns');
const tbxSerial = document.getElementById('serial');
const btnClicky = document.getElementById('clicky');

// modplayer
const btnPlay = document.getElementById('play');

// scroller
const canvas = document.getElementById('scroller');
const ctx = canvas.getContext('2d');

// accessibility
const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
var reducedMotion = mediaQuery.matches;


// ===== keygen =====
function pronounsAreValid(pronouns) {
	const bannedWords = ['helicopter'];

	pronouns = pronouns.trim().toLowerCase();

	if (pronouns.length == 0) {
		return false;
	}

	var onlyText = "";
	for (var i = 0; i < pronouns.length; ++i) {
		if ((pronouns[i] >= 'a' && pronouns[i] <= 'z') || (pronouns[i] >= 'A' && pronouns[i] <= 'Z')) {
			onlyText += pronouns[i];
		}
	}

	if (bannedWords.some((bannedWord) => onlyText.includes(bannedWord))) {
		return false;
	}

	return true;
}

function generateKey() {
	const alphabet = 'BCDFGHJKMPQRTVWXY346789';
	// ^ microsoft's sanitized alphabet
	// source: https://stackoverflow.com/a/36294356

	var key = '';
	for (var i = 0; i < 15; ++i) {
		key += alphabet[Math.floor(Math.random() * alphabet.length)];
	}

	return key.substring(0, 5) + '-' + key.substring(5, 10) + '-' + key.substring(10, 15)
}
// ===== keygen =====


// ===== scroller =====
const scrollWidth = 350;
const scrollHeight = 120;
var start, previousTimeStamp;
var stars = [];

const transColors = ['#5BCEFA', '#F5A9B8', '#FFF', '#F5A9B8', '#5BCEFA'];

function initScroller() {
	const density = 3;
	for (var i = 0; i < scrollHeight*density; ++i) {
		const x = Math.floor(Math.random() * scrollWidth);
		const y = i/density;
		const layer = (Math.random() * 5);
		const stripe = Math.floor((y * transColors.length) / scrollHeight);
		stars[i] = {
			'x': x,
			'y': y,
			'speed': (layer + 1),
			'size': (layer + 3) / 2,
			'color': transColors[stripe],
			'alpha': 0.5 + (layer / 5) * 0.5
		};
	}
}

function renderScroller(timestamp) {
	if (start === undefined) {
		start = timestamp;
	}
	const elapsedMs = timestamp - start;

	ctx.fillStyle = 'black';
	ctx.fillRect(0, 0, scrollWidth, scrollHeight);

	for (var i = 0; i < stars.length; ++i) {
		ctx.fillStyle = stars[i].color;
		ctx.globalAlpha = stars[i].alpha;
		ctx.fillRect(
			stars[i].x - (stars[i].size/2),
			stars[i].y - (stars[i].size/2),
			stars[i].size,
			stars[i].size
		);
		if (!reducedMotion) {
			stars[i].x -= stars[i].speed;
			if (stars[i].x < 0) {
				stars[i].x += scrollWidth;
			}
		}
	}
	ctx.globalAlpha = 1;

	window.requestAnimationFrame(renderScroller);
}
// ===== scroller =====


// ===== modplayer =====
// code cannibalized from the modarchive embedded player
var modplayer;
function pauseButton() {
	button = document.getElementById('play')
	if(modplayer.togglePause())
		button.innerHTML = "Pause";
	else
		button.innerHTML = "Play";
}

if (typeof ChiptuneAudioContext == 'undefined')
{
	console.log("welp, no audio support :(");
}

function initModPlayer()
{
	libopenmpt.onRuntimeInitialized = _ =>
	{
		modplayer = new ChiptuneJsPlayer(new ChiptuneJsConfig(-1));

		modplayer.load("space_debris.mod.zip", function(buffer) {
			document.getElementById('play').innerHTML = modplayer.play(buffer) ? "Pause" : "Play";
			modplayer.setRepeatCount(-1);
			setInterval(function(){}, 500);
		});
	};
}
// ===== modplayer =====


tbxPronouns.addEventListener('input', (e) => {
	if (pronounsAreValid(tbxPronouns.value)) {
		btnClicky.removeAttribute('disabled');
	} else {
		btnClicky.setAttribute('disabled', "");
	}
});

btnClicky.addEventListener('click', (e) => {
	tbxSerial.value = generateKey();
});

btnPlay.addEventListener('click', (e) => {
	pauseButton();
});

mediaQuery.addEventListener('change', () => {
	reducedMotion = mediaQuery.matches;
});

initScroller();
window.requestAnimationFrame(renderScroller);