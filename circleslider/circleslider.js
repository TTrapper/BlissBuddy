(function (root, factory) {
  var $ = root.jQuery;

  if (typeof define === 'function' && define.amd) {
    // AMD
    if ($) {
      define([], factory.bind(null, $));
    }
    else {
      define(['jquery'], factory);
    }
  } else if (typeof exports === 'object') {
    // Node, CommonJS-like
    if ($) {
      module.exports = factory($);
    }
    else {
      module.exports = factory(require('jquery'));
    }
  } else {
    // Browser globals (root is window)
    if ($) {
      factory($); // no global needed as we store it as a jQuery plugin on jQuery.fn
    }
    else {
      throw 'Missing required jQuery dependency';
    }
  }
}(this, function ($) {
  var isDragging = false;
  var $currentHandle = null;


  function drawBlip($container, positionAsPercent) {
    var $input = $container.find('input');
    var minimumDegree = parseInt($input.data("mindegree")) || 0; 
    var maximumDegree = parseInt($input.data("maxdegree")) || 359;

    var degrees = percentRangeToDegree(positionAsPercent, minimumDegree, maximumDegree);
    drawCircle($container, degrees-20, degrees+20);
  }


  function drawCircle($container, degreeStart, degreeEnd) {

    var
      $canvas = $container.find('canvas'),
      canvas = $canvas[0]
    ;

    var outerWidth = $container.outerWidth();
    var innerWidth = $container.innerWidth();
    var borderWidth = outerWidth - innerWidth;
    $canvas.css('left', borderWidth*-1);
    $canvas.css('top', borderWidth*-1);


    var radius = (outerWidth - borderWidth / 2) / 2;
    canvas.width = outerWidth + borderWidth;
    canvas.height = canvas.width;
    var context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.beginPath();


    context.arc(canvas.width / 2, canvas.width / 2,radius, degreesToRadians(degreeStart)-Math.PI/2, degreesToRadians(degreeEnd)-Math.PI/2, false);
    context.lineWidth = borderWidth/2;
    context.strokeStyle = $canvas.css('color');
    context.stroke();
  }

  function degreesToRadians (degrees) {
    return degrees * (Math.PI/180);
  }

  function rotateToOrigin(degrees, minimumDegree) {
    return (degrees + (360 - minimumDegree)) % 360;
  }

  function percentRangeToDegree(percent, minimumDegree, maximumDegree) {
    var range = rotateToOrigin(maximumDegree, minimumDegree);
    var degrees = (percent / 100) * range;
    return (degrees + minimumDegree) % 360
  }
  
  function degreesToPercentRange(degrees, minimumDegree, maximumDegree) {
    var degrees = rotateToOrigin(degrees, minimumDegree);
    var range = rotateToOrigin(maximumDegree, minimumDegree);
    return 100 * degrees / range;
  }

  function updateWidget($container) {
    var $handles = $container.find('.handle');
    var $handle1 = $container.find('.handle1');
    var $handle2 = $container.find('.handle2');

    var outerWidth = $container.outerWidth();
    var innerWidth = $container.innerWidth();
    var borderWidth = (outerWidth - innerWidth) / 2;
    var handleWidth = $handles.outerWidth();

    var radius = (outerWidth - borderWidth) / 2;

    var $input = $container.find('input');
    var minimumDegree = parseInt($input.data("mindegree")) || 0; 
    var maximumDegree = parseInt($input.data("maxdegree")) || 359; 
    var unit = '%';
    var stepSize = 1;

    $handles.each(function(idx, handle) {
      var $handle = $(handle);
      var value = $handle.attr('data-value');
      var percent = degreesToPercentRange(parseFloat(value), minimumDegree, maximumDegree);
      var deg = value*stepSize;

      var X = Math.round(radius + radius * Math.sin(degreesToRadians(deg)));
      var Y = Math.round(radius + radius * -Math.cos(degreesToRadians(deg)));
      $handle.css({ left: X, top: Y });
      
      $container.find($handle.attr('data-value-target')).html(Math.floor(percent) + unit);
      $input.attr('percent-value-' + (idx + 1), percent);
    });

    value1 = $handle1.attr('data-value');
    value2 = $handle2.attr('data-value');
    $input.val(value1+';'+value2).trigger('change');
  }

  function init($input) {
    var values = $input.val() || '0;0';
    values = values.split(';');
    var value1 = parseInt(values[0], 10);
    var value2 = parseInt(values[1], 10);
      
    var minimumDegree = parseInt($input.data("mindegree")) || 0; 
    var maximumDegree = parseInt($input.data("maxdegree")) || 359;

    $container = $('<div class="circle-range-select-wrapper"></div>');
    $input.wrap($container);
    $container = $input.parent();

    $container.append('<div class="handle handle1" data-value="' + value1 + '" data-value-target=".value1"></div>');
    $container.append('<div class="handle handle2" data-value="' + value2 + '" data-value-target=".value2"></div>');
    $container.append('<div class="values"><span class="value1"></span> - <span class="value2"></span></div>');
    $container.append('<canvas class="selected-range"></canvas>');

    updateWidget($container);

    $container.on('mousedown touchstart', '.handle', function(e) {
      isDragging = true;
      e.preventDefault();
      $currentHandle = $(e.target);
      $(document).on('mouseup touchend', function() {
        isDragging = false;
        $currentHandle = null;
      });
    });

    $(window).on('resize', updateWidget.bind(null, $container));
  }

  $(document).on('mousemove touchmove', function (e) {
    if (isDragging) {
      var $container = $currentHandle.closest('.circle-range-select-wrapper');
      var radius = $container.width() / 2;

      if (!e.offsetX && e.originalEvent.touches) {
        // touch events
        var targetOffset = $(e.target).offset();
        e.offsetX = e.originalEvent.touches[0].pageX - targetOffset.left;
        e.offsetY = e.originalEvent.touches[0].pageY - targetOffset.top;
      }
      else if(typeof e.offsetX === "undefined" || typeof e.offsetY === "undefined") {
        // firefox compatibility
        var targetOffset = $(e.target).offset();
        e.offsetX = e.pageX - targetOffset.left;
        e.offsetY = e.pageY - targetOffset.top;
      }

      var mPos = {
        x: e.target.offsetLeft + e.offsetX,
        y: e.target.offsetTop + e.offsetY
      };

      var atan = Math.atan2(mPos.x - radius, mPos.y - radius);
      var deg = -atan / (Math.PI / 180) + 180; // final (0-360 positive) degrees from mouse position

      var $input = $container.find('input');
      var stepSize = 1;

      var value = Math.round(deg/stepSize);
      var currentValueOfSlider = $input.val();
 
      if( value > 125 && value < 235 ){ // TODO hard coded boundary values
         return;
      }

      $currentHandle.attr('data-value', value);
      updateWidget($container);
    }
  });

  $.fn.lcnCircleRangeSelect = function() {
    return this.each(function() {
      init($(this));
    });

  };

  $.fn.drawBlip = function(positionAsPercent) {
    return this.each(function() {
      drawBlip($(this).parent(), positionAsPercent);
    });

  };

}));
