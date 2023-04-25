var midiConnectWrapper,
    midiAccess,
    midiOutput,
    messageBanner,
    midiChannel = 2,
    timeOffset = 0,
    midiListeners = [];

function LFOBox(settings) {
    var
        div = settings.div,
        on = settings.on || false,
        waveType = settings.waveType || 'sine',
        frequency = settings.frequency || 1,
        sweepstart = settings.sweepstart || 0.5,
        sweepend = settings.sweepend || 0.5,
        waveLength,
        waveFuncs,
        activeWaveFunc,
        lastRandomValue,
        lastTimeRandom = 0,
        timeOffset = 0,
        waveData = [],
        lastAddTime,
        syncOnNote = false,

        // Elements
        ccLabel = div.getElementsByClassName('cc-label')[0],
        onOffWrapper = div.getElementsByClassName('on-off')[0],
        onButton = div.getElementsByClassName('on-button')[0],
        offButton = div.getElementsByClassName('off-button')[0],
        circleRangeSelect = div.getElementsByClassName('circle-range-select')[0],
        canvasWrapper = div.getElementsByClassName('canvas-wrapper')[0],
        waveCanvas = div.getElementsByClassName('wave-canvas')[0],
        noiseButton = div.getElementsByClassName('noise-button')[0],
        waveSelect = div.getElementsByClassName('wave-select')[0],
        frequencyInput = div.getElementsByClassName('frequency input')[0],
        frequencySlider = div.getElementsByClassName('slider frequency-slider')[0],
        yesButton = div.getElementsByClassName('yes-button')[0],
        noButton = div.getElementsByClassName('no-button')[0],
        context = waveCanvas.getContext('2d');


    waveFuncs = {
        'sine': function (step) {return Math.sin(step * Math.PI * 2)},
        'square': function (step) {return step < 0.5 ? 1 : -1},
        'sawtooth': function (step) {return 2 * (step - Math.round(step))},
        'reverse-sawtooth': function (step) {return 2 * (1 - step) - 1},
        'triangle': function (step) {return Math.abs(Math.round(step) - step) * 4 - 1},
        'noise': function () {
            if (!lastTimeRandom || getTime() > lastTimeRandom + (1000/frequency)) {
                lastTimeRandom = getTime();

                lastRandomValue = (Math.random() * 2 - 1);
            }

            return lastRandomValue;
        }
    };

    function draw() {
        var x,
            y;

        context.clearRect(0, 0, waveLength, 200);

        context.beginPath();
        context.lineWidth = 5;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.strokeStyle = '#333333';
        for (x = 0; x <= waveLength - 6; x += 1) {

            y = -1 * (waveData[x] || 0);
            // Make the wave fit the canvas
            y = ((context.canvas.clientHeight - context.lineWidth) * y) + (0.5 * context.lineWidth);

            if (x == 0) {
                context.moveTo(x+3, y);
            }
            else {
                context.lineTo(x+3, y);
            }
        }
        context.stroke();

        requestAnimationFrame(draw);
    }

    function sendCC() {
        var step,
            value,
            bottom,
            amplitude;

        if (on) {
            step = (getTime() % (1000 / frequency)) / (1000 / frequency);

            sweepstart = $(circleRangeSelect).attr('percent-value-1') / 100;
            sweepend = $(circleRangeSelect).attr('percent-value-2') / 100;
            bottom = Math.min(sweepstart, sweepend);
            amplitude = sweepend - sweepstart;
            value = (((activeWaveFunc(step) * amplitude) + Math.abs(amplitude)) / 2) + bottom;

            $(circleRangeSelect).drawBlip(100 * value);

            if (midiOutput) {
                midiOutput.send([0xB0 + (midiChannel - 1), settings.ccNumber + 13, 127 * value]);
            }
        }

        if (Math.round(getTime()) != lastAddTime) {
            waveData.unshift(value - 1);
            waveData.length = 1000;

            lastAddTime = Math.round(getTime());
        }
        setTimeout(sendCC, 20); // TODO how fast should it be?
    }


    function getInputValues() {
        frequency = frequencyInput.value;
    }

    function getTime() {
        if (syncOnNote) return performance.now() - timeOffset;
        else return performance.now();
    }

    // Initialization
    activeWaveFunc = waveFuncs['sine'];

    midiListeners.push(function (event) {
        switch (event.data[0] & 0xf0) {
            case 0x90:
                if (event.data[2]!=0) {  // if velocity != 0, this is a note-on message
                    timeOffset = performance.now();
                    lastTimeRandom = 0;
                }
        }
    });

    setTimeout(function () {
        waveCanvas.width = waveLength = canvasWrapper.offsetWidth;
    }, 100);

    waveSelect.addEventListener('change', function () {
        var func = waveFuncs[waveSelect.value];

        if (func) {
            activeWaveFunc = func;
        }
    });

    onOffWrapper.addEventListener('click', function (event) {
        event.preventDefault();

        on = !on;

        if (on) {
            onButton.className = 'on-button';
            offButton.className = 'dim off-button';
        }
        else {
            onButton.className = 'dim on-button';
            offButton.className = 'off-button';
        }
    });


    "click keydown".split(" ").forEach(function(eName) {
        frequencySlider.addEventListener(eName, function (event) {
            frequency = event.target.value;
            frequencyInput.value = frequency;
        });
    });


    frequencyInput.addEventListener('change', getInputValues);
    frequencyInput.addEventListener('keyup', getInputValues);

    div.className = 'lfo-box ' + settings.class;
    ccLabel.innerHTML = 'Knob ' + settings.ccNumber;
    frequencyInput.value = frequency;
    sendCC();
    draw();
    $(circleRangeSelect).lcnCircleRangeSelect();
}

function showBanner(text) {
    messageBanner.innerHTML = text;
    messageBanner.style.display = 'block';
}

function hideBanner() {
    messageBanner.style.display = 'none';
}

function setupMIDIInput() {
    midiAccess.inputs.forEach(function (input) {
        if (input.name.indexOf('Conduit MIDI 1') > -1) {
            input.onmidimessage = function (event) {
                midiListeners.forEach(function (listener) {
                    listener(event);
                });
            };
        }
    });
}

function connectMIDIOut(portName){
    midiAccess.outputs.forEach(function (output) {
        if (output.name.indexOf(portName) > -1) {
            midiOutput = output;
        }
    });
}

function buildMIDIOutList() {
    var midiOutList = document.getElementById('midi-ports');
    midiOutList.innerHTML = '';
    midiAccess.outputs.forEach(function (output) {
        var li = document.createElement('li');
        if (output == midiOutput) {
           $(li).addClass('active');
        }
        li.innerHTML = output.name;
        midiOutList.appendChild(li);
        li.addEventListener('click', function(event) {
           $('#midi-ports li').removeClass('active');
           $(event.target).addClass('active');
           connectMIDIOut(event.target.innerHTML);
        });
    });
}

function setupMIDIOutput(event) {
    if (midiAccess.outputs.size == 0) {
        showBanner('Could not find any MIDI out channels &#128542;\nEnsure connection &#128515;');
    }
    else {
        hideBanner();
    }
    buildMIDIOutList();
}

function onMIDIInit(midi) {
    midiAccess = midi;
    setupMIDIOutput();
    midiAccess.onstatechange = setupMIDIOutput;
}

function onMIDIReject(err) {
    showBanner('MIDI system failed to start &#128542;\nTry again &#128515;');
}



// Setup
window.onload = function () {
    document.getElementById("midi-channel-select").addEventListener("change", function (event) {
        midiChannel = parseInt(event.target.value, 10);
    });

    document.getElementById("change-midi-channel").addEventListener("click", function () {
        if (midiOutput) {
            midiOutput.send([0xC0 | (midiChannel - 1), midiChannel - 1]);
            showBanner("MIDI Channel change message sent to Chase Bliss Pedal on Channel: " + midiChannel);
            setTimeout(hideBanner, 3000);
        } else {
            showBanner("No MIDI output selected. Please select a MIDI output port.");
            setTimeout(hideBanner, 3000);
        }
    });
};

window.addEventListener('load', function () {

    var template = document.getElementById('lfo-box-template').innerHTML,
        settingsObjects = [
            {'ccNumber': 1, 'class': 'blue'},
            {'ccNumber': 2, 'class': 'blue'},
            {'ccNumber': 3, 'class': 'blue'},
            {'ccNumber': 4, 'class': 'blue'},
            {'ccNumber': 5, 'class': 'blue'},
            {'ccNumber': 6, 'class': 'blue'}
        ];

    messageBanner = document.getElementById('message-banner');

    if (!window.performance) {
        window.performance = {
            'now': function () {
                return (new Date()).getTime();
            }
        };
    }

    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess().then(onMIDIInit, onMIDIReject);
    }
    else {
        showBanner('Your browser does not support MIDI &#128542;\nTry Chrome &#128515;');
    }

    settingsObjects.forEach(function (settings) {
        var div = settings.div = document.getElementById(settings.ccNumber);

        div.innerHTML = template;

        setTimeout(function () {new LFOBox(settings)}, 0);
    });
});
