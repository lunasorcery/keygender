// based on https://deskjet.github.io/chiptune2.js/
var libopenmpt = { memoryInitializerPrefixURL : "style/js/" };

function asciiToStack(str) {
  var stackStr = stackAlloc(str.length + 1);
  writeAsciiToMemory(str, stackStr);
  return stackStr;
}

// audio context
ChiptuneAudioContext = AudioContext || webkitAudioContext;

// config
function ChiptuneJsConfig(repeatCount) {
  this.repeatCount = repeatCount;
}

// player
function ChiptuneJsPlayer(config) {
  this.context = new ChiptuneAudioContext;
  this.config = config;
  this.currentPlayingNode = null;
  this.handlers = [];
}

// event handlers section
ChiptuneJsPlayer.prototype.fireEvent = function (eventName, response) {
  var  handlers = this.handlers;
  if (handlers.length) {
    handlers.forEach(function (handler) {
      if (handler.eventName === eventName) {
        handler.handler(response);
      }
    })
  }
}

ChiptuneJsPlayer.prototype.addHandler = function (eventName, handler) {
  this.handlers.push({eventName: eventName, handler: handler});
}

ChiptuneJsPlayer.prototype.onEnded = function (handler) {
  this.addHandler('onEnded', handler);
}

ChiptuneJsPlayer.prototype.onError = function (handler) {
  this.addHandler('onError', handler);
}

// metadata
ChiptuneJsPlayer.prototype.duration = function() {
  return libopenmpt._openmpt_module_get_duration_seconds(this.currentPlayingNode.modulePtr);
}

ChiptuneJsPlayer.prototype.seek = function(position) {
  libopenmpt._openmpt_module_set_position_seconds(this.currentPlayingNode.modulePtr, position);
}

ChiptuneJsPlayer.prototype.getPosition = function() {
  return libopenmpt._openmpt_module_get_position_seconds(this.currentPlayingNode.modulePtr);
}

ChiptuneJsPlayer.prototype.metadata = function() {
  var module = this.currentPlayingNode.modulePtr;
  var data = {};
  var keys = UTF8ToString(libopenmpt._openmpt_module_get_metadata_keys(module)).split(';');
  var keyNameBuffer = 0;
  for (var i = 0; i < keys.length; i++) {
    keyNameBuffer = libopenmpt._malloc(keys[i].length + 1);
    writeAsciiToMemory(keys[i], keyNameBuffer);
    data[keys[i]] = UTF8ToString(libopenmpt._openmpt_module_get_metadata(module, keyNameBuffer));
    libopenmpt._free(keyNameBuffer);
  }
  return data;
}

// playing, etc
ChiptuneJsPlayer.prototype.unlock = function() {

  var context = this.context;
  var buffer = context.createBuffer(1, 1, 22050);
  var unlockSource = context.createBufferSource();

  unlockSource.buffer = buffer;
  unlockSource.connect(context.destination);
  unlockSource.start(0);

  this.touchLocked = false;
}

ChiptuneJsPlayer.prototype.subsongs = function() {
  var module = this.currentPlayingNode.modulePtr;
  var subsongs = libopenmpt._openmpt_module_get_num_subsongs(module);
  var names = []
  for (var i = 0; i < subsongs; i++) {
    var namePtr = libopenmpt._openmpt_module_get_subsong_name(module, i);
    var name = UTF8ToString(namePtr);
    if(name != "") {
      names.push(name)
    } else {
      names.push("Subsong " + (i + 1));
    }
    libopenmpt._openmpt_free_string(namePtr);
  }
  return names;
}

ChiptuneJsPlayer.prototype.load = function(input, callback) {

  if (this.touchLocked)
  {
    this.unlock();
  }

  var player = this;
  if (input instanceof File) {
    var reader = new FileReader();
    reader.onload = function() {
      return callback(reader.result); // no error
    }.bind(this);
    reader.readAsArrayBuffer(input);
  } else {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', input, true);
    xhr.responseType = 'arraybuffer';
    xhr.onprogress = function(e) {
      if (e.lengthComputable) {
        document.getElementById("play").innerHTML = "Loading... " + Math.floor((e.loaded / e.total) * 100) + "%";
      }
    };
    xhr.onload = function(e) {
      if (xhr.status === 200 /*&& e.total*/) {
        return callback(xhr.response); // no error
      } else {
        player.fireEvent('onError', {type: 'onxhr'});
      }
    }.bind(this);
    xhr.onerror = function() {
      document.getElementById("play").innerHTML = "Error while downloading file for playback :-(";
      player.fireEvent('onError', {type: 'onxhr'});
    };
    xhr.onabort = function() {
      player.fireEvent('onError', {type: 'onxhr'});
    };
    xhr.send();
  }
}

ChiptuneJsPlayer.prototype.play = function(buffer) {
  this.stop();
  var processNode = this.createLibopenmptNode(buffer, this.config);
  if (processNode == null) {
    return false;
  }

  // set config options on module
  libopenmpt._openmpt_module_set_repeat_count(processNode.modulePtr, this.config.repeatCount);

  this.currentPlayingNode = processNode;
  processNode.connect(this.context.destination);
  return this.context.state === 'running';
}

ChiptuneJsPlayer.prototype.stop = function() {
  if (this.currentPlayingNode != null) {
    this.currentPlayingNode.disconnect();
    this.currentPlayingNode.cleanup();
    this.currentPlayingNode = null;
  }
}

ChiptuneJsPlayer.prototype.togglePause = function() {
    if (this.currentPlayingNode != null)
    {
        if(this.context.state === 'running')
        {
            this.currentPlayingNode.pause();
            this.context.suspend();
            return false;
        } else
        {
            this.currentPlayingNode.unpause();
            this.context.resume();
            return true;
        }
    }
    return false;
}

ChiptuneJsPlayer.prototype.setRepeatCount = function(repeatCount) {
    this.config.repeatCount = repeatCount;
	libopenmpt._openmpt_module_set_repeat_count(this.currentPlayingNode.modulePtr, repeatCount);
}

ChiptuneJsPlayer.prototype.selectSubsong = function(subsong) {
	libopenmpt._openmpt_module_select_subsong(this.currentPlayingNode.modulePtr, subsong);
}

ChiptuneJsPlayer.prototype.createLibopenmptNode = function(buffer, config) {
  // TODO error checking in this whole function

  var maxFramesPerChunk = 4096;
  var processNode = this.context.createScriptProcessor(2048, 0, 2);
  processNode.config = config;
  processNode.player = this;
  var byteArray = new Int8Array(buffer);
  var ptrToFile = libopenmpt._malloc(byteArray.byteLength);
  libopenmpt.HEAPU8.set(byteArray, ptrToFile);
  processNode.modulePtr = libopenmpt._openmpt_module_create_from_memory(ptrToFile, byteArray.byteLength, 0, 0, 0);

  var stack = stackSave();
  libopenmpt._openmpt_module_ctl_set(processNode.modulePtr, asciiToStack('render.resampler.emulate_amiga'), asciiToStack('1'));
  libopenmpt._openmpt_module_ctl_set(processNode.modulePtr, asciiToStack('render.resampler.emulate_amiga_type'), asciiToStack('a1200'));
  stackRestore(stack);

  processNode.paused = false;
  processNode.leftBufferPtr  = libopenmpt._malloc(4 * maxFramesPerChunk);
  processNode.rightBufferPtr = libopenmpt._malloc(4 * maxFramesPerChunk);
  processNode.cleanup = function() {
    if (this.modulePtr != 0) {
      libopenmpt._openmpt_module_destroy(this.modulePtr);
      this.modulePtr = 0;
    }
    if (this.leftBufferPtr != 0) {
      libopenmpt._free(this.leftBufferPtr);
      this.leftBufferPtr = 0;
    }
    if (this.rightBufferPtr != 0) {
      libopenmpt._free(this.rightBufferPtr);
      this.rightBufferPtr = 0;
    }
  }
  processNode.stop = function() {
    this.disconnect();
    this.cleanup();
  }
  processNode.pause = function() {
    this.paused = true;
  }
  processNode.unpause = function() {
    this.paused = false;
  }
  processNode.togglePause = function() {
    this.paused = !this.paused;
  }
  processNode.onaudioprocess = function(e) {
    var outputL = e.outputBuffer.getChannelData(0);
    var outputR = e.outputBuffer.getChannelData(1);
    var framesToRender = outputL.length;
    if (this.ModulePtr == 0) {
      for (var i = 0; i < framesToRender; ++i) {
        outputL[i] = 0;
        outputR[i] = 0;
      }
      this.disconnect();
      this.cleanup();
      return;
    }
    if (this.paused) {
      for (var i = 0; i < framesToRender; ++i) {
        outputL[i] = 0;
        outputR[i] = 0;
      }
      return;
    }
    var framesRendered = 0;
    var ended = false;
    var error = false;
    while (framesToRender > 0) {
      var framesPerChunk = Math.min(framesToRender, maxFramesPerChunk);
      var actualFramesPerChunk = libopenmpt._openmpt_module_read_float_stereo(this.modulePtr, this.context.sampleRate, framesPerChunk, this.leftBufferPtr, this.rightBufferPtr);
      if (actualFramesPerChunk == 0) {
        ended = true;
        if(document.getElementById('autoplay').checked) {
            window.location.href = 'index.php?request=view_player&query=random&autoplay';
        }
        // modulePtr will be 0 on openmpt: error: openmpt_module_read_float_stereo: ERROR: module * not valid or other openmpt error
        error = !this.modulePtr;
      }
      var rawAudioLeft = libopenmpt.HEAPF32.subarray(this.leftBufferPtr / 4, this.leftBufferPtr / 4 + actualFramesPerChunk);
      var rawAudioRight = libopenmpt.HEAPF32.subarray(this.rightBufferPtr / 4, this.rightBufferPtr / 4 + actualFramesPerChunk);
      for (var i = 0; i < actualFramesPerChunk; ++i) {
        outputL[framesRendered + i] = rawAudioLeft[i];
        outputR[framesRendered + i] = rawAudioRight[i];
      }
      for (var i = actualFramesPerChunk; i < framesPerChunk; ++i) {
        outputL[framesRendered + i] = 0;
        outputR[framesRendered + i] = 0;
      }
      framesToRender -= framesPerChunk;
      framesRendered += framesPerChunk;
    }
    if (ended) {
      this.disconnect();
      this.cleanup();
      error ? processNode.player.fireEvent('onError', {type: 'openmpt'}) : processNode.player.fireEvent('onEnded');
    }
  }
  return processNode;
}

