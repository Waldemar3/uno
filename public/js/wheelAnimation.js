function wheelAnimation(game){
  const canvas = $('#wheelAnimation'),
        ctx = canvas.element.getContext("2d"),

        { width, height } = canvas.element,

        wheelOffset = 3,

        opacitySpeed = 200,

        numberOfRects = 20,
        rectWidth = 10,
        rectHeight = 20,
        rectRadius = 5,
        rectBlur = 5;

  return {
    rotationAnimation: null,
    lastDirection: null,
    rectColor: null,
    opacity: 0,

    rect: function(rotate){
      const x=0,y=0, r = x + rectWidth, b = y + rectHeight, { red, green, blue } = this.hexToRgb(this.rectColor);
      ctx.clearRect(0,0,width,height);
      ctx.save();
      ctx.translate(width/2,height/2);
      ctx.rotate(rotate*Math.PI/180);
      ctx.translate(-rectWidth/2,height/2-rectHeight-wheelOffset);
      ctx.shadowColor = this.rectColor;
      ctx.shadowBlur = rectBlur;
      ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${this.opacity})`;
      ctx.moveTo(x+rectRadius, y);
      ctx.lineTo(r-rectRadius, y);
      ctx.quadraticCurveTo(r, y, r, y+rectRadius);
      ctx.lineTo(r, y+rectHeight-rectRadius);
      ctx.quadraticCurveTo(r, b, r-rectRadius, b);
      ctx.lineTo(x+rectRadius, b);
      ctx.quadraticCurveTo(x, b, x, b-rectRadius);
      ctx.lineTo(x, y+rectRadius);
      ctx.quadraticCurveTo(x, y, x+rectRadius, y);
      ctx.fill();
      ctx.restore();
    },
    hexToRgb: function(hex) {
      var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        red: parseInt(result[1], 16),
        green: parseInt(result[2], 16),
        blue: parseInt(result[3], 16)
      } : null;
    },
    changeRotation: function(direction, color){
      const { colorCodes } = game.getState().config;

      if(!this.rectColor){
        this.rectColor = colorCodes[color];
        canvas.animate(effect=>this.opacity=effect, 'swing', opacitySpeed);
      }

      if(this.rectColor !== colorCodes[color]){
        canvas.animate(effect=>this.opacity=1-effect, 'swing', opacitySpeed, ()=>{
          this.rectColor = colorCodes[color];
          canvas.animate(effect=>this.opacity=effect, 'swing', opacitySpeed);
        });
      }

      if(this.lastDirection !== direction){
        if(this.rotationAnimation) this.rotationAnimation.stop();
        this.lastDirection = direction;

        if(direction){
          this.rotateRight();
        }else{
          this.rotateLeft();
        }
      }
    },
    rotateRight: function(){
      const { timeToFullWheelRotation } = game.getState().config.gameOptions, rotate = $('#wheelAnimation').getTransform('rotate');

      this.rotationAnimation = $('#wheelAnimation').animate({custom: index=>{
        ctx.beginPath();
        for(let i=0; i<numberOfRects; i++){
          this.rect(360/numberOfRects*i+index);
        }
      }, rotate: 360}, 'linear', timeToFullWheelRotation-timeToFullWheelRotation/100*(rotate/360*100), e=>{
        e.setTransform('rotate', 0);
        this.rotateRight();
      });
    },
    rotateLeft: function(){
      const { timeToFullWheelRotation } = game.getState().config.gameOptions, rotate = $('#wheelAnimation').getTransform('rotate');

      this.rotationAnimation = $('#wheelAnimation').animate({custom: index=>{
        ctx.beginPath();
        for(let i=0; i<numberOfRects; i++){
          this.rect(360/numberOfRects*i+index);
        }
      }, rotate: 0}, 'linear', timeToFullWheelRotation/100*(rotate/360*100), e=>{
        e.setTransform('rotate', 360);
        this.rotateLeft();
      });
    },
  }
}
