const WebSocketQueue = {
  queue: [],
  add: function(handler){
    if(this.queue.length === 0) handler(this);
    this.queue.push(()=>handler(this));
  },
  end: function(){
    this.queue.shift();
    if(this.queue[0]) this.queue[0]();
  },
};

const ComponentManager = {
  startComponent: null,
  activeComponents: {},
  components: {},
  state: {},
  noticeListElement: null,
  setComponentTree: function(tree){
    const init = e => {

      this.treeHandler(tree);
      this.startComponent = new this.startComponent();

      window.removeEventListener('load', init, false);
    };
    window.addEventListener('load', init, false);
  },
  treeHandler: function(tree, parent = null){
    for(branch in tree){
      const newComponent = new this.components[branch]();
      const branchIsObject = typeof tree[branch] === 'object';
      newComponent.parent = parent;
      newComponent.children = branchIsObject ? this.getChildren(tree[branch]) : null;
      this.components[branch] = newComponent;
      if(branchIsObject) this.treeHandler(tree[branch], branch);
    }
  },
  getChildren: function(childrenObj){
    let children = [];
    for(child in childrenObj){
      children.push(child);
    }
    return children;
  },
};

function Component(element = null){
  return class {
    constructor(){
      this.timer = null;
      this.active = false;
      this.parent = null;
      this.children = null;
      this.handlers = {};
      this.element = element;
    }
    setState(state){
      ComponentManager.state = {...ComponentManager.state, ...state};
    }
    getState(){
      return ComponentManager.state;
    }
    react(component, fun, value = null){
      const reactedComponent = ComponentManager.components[component];
      if(reactedComponent.active) reactedComponent[fun](value);
    }
    useComponent(component){
      return ComponentManager.components[component];
    }
    addNotice(component, properties = {}, time = null){
      const addedComponent = ComponentManager.components[component];
      ComponentManager.noticeListElement = addedComponent.element;
      $(addedComponent.element).prepend(this.useTemplate(component, properties));
      const firstNotice = $(addedComponent.element).children()[0];
      const height = firstNotice.offset().height;
      firstNotice.css({position: 'static', height: '0px', padding: '0px', opacity: 1}).animate({height: `${height}:px`, padding: '6:px'}, 'bounce', 800);

      this.addHandlers(addedComponent);

      if(time) setTimeout(()=>this.closeNotice(firstNotice), time*1000);
    }
    removeNotice(e){
      this.closeNotice($(e.target.closest('.notice')));
    }
    removeAllNotices(){
      if(ComponentManager.noticeListElement) $(ComponentManager.noticeListElement).children().forEach(notice => this.closeNotice(notice));
    }
    setNoticeTimer(from, to, c=null){
      const noticeContent = $('#noticeContent').html();
      let timer = () => {
        let minute = (to-(Date.now()-from)/1000)/60, min = parseInt(minute), sec = parseInt(60/100*(minute-min)*100), secWithZero = (sec < 10 ? '0'+sec : sec);
        $('#noticeContent').html(noticeContent+` ${min >= 1 ? min+':'+secWithZero : '0:'+secWithZero}`);

        if(min <= 0 && sec <= 0){
          $('#noticeContent').html(noticeContent+` 0:00`);
          clearInterval(this.timer); if(c) c();
        }
      };

      this.timer = setInterval(()=>timer(),1000);

      timer();
    }
    closeNotice(notice){
      notice.animate({height: '0:px', padding: '0:px'}, 'swing', 300, e=>{
        e.remove();
        const noticeListElement = $(ComponentManager.noticeListElement);
        if(noticeListElement.children().length === 0) noticeListElement.off();
      });
    }
    add(component, properties = {}){
      const addedComponent = ComponentManager.components[component];
      if((addedComponent.parent === null || ComponentManager.components[addedComponent.parent].active) && !addedComponent.active){

        const activeComponents = ComponentManager.activeComponents;
        if(activeComponents[addedComponent.element]) this.remove(activeComponents[addedComponent.element]);

        addedComponent.active = true;
        activeComponents[addedComponent.element] = addedComponent.constructor.name;

        const template = this.useTemplate(component, properties);
        if(template) $(addedComponent.element).html(template);

        if(addedComponent.init) addedComponent.init();

        this.addHandlers(addedComponent);
      }
    }
    remove(component = null){
      const removableComponent = component ? ComponentManager.components[component] : this;
      if(removableComponent.active){
        const children = removableComponent.children;
        if(children){
          children.forEach(child => {
            const childComponent = ComponentManager.components[child];
            if(childComponent.active){
              childComponent.remove();
            }
          });
        }

        this.removeHandlers(removableComponent);

        delete ComponentManager.activeComponents[removableComponent.element];
        $(removableComponent.element).html('');
        if(removableComponent.uninit) removableComponent.uninit();
        removableComponent.active = false;
      }
    }
    useTemplate(template, properties = {}){
      let templateString = ComponentManager.state.Templates[template];
      if(!templateString) return false;

      for (let property in properties){
        templateString = templateString.replace(new RegExp(`{{${property}}}`, 'g'), properties[property]);
      }

      return templateString;
    }
    useImage(template, properties = {}, c){
      let img = new Image();
      img.onload = function(){c(this);};
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(this.useTemplate(template, properties));
    }
    addHandlers(component){
      const handlers = component.handlers;
      for(let handler in handlers){
        if(handler === 'resize'){
          $(window).on(handler, handlers[handler]);
        }else{
          for(let element in handlers[handler]){
            if(element === 'delegate'){
              const selectors = handlers[handler][element], firstEntryIsString = typeof selectors[0] === 'string',
              delegate = firstEntryIsString ? selectors[0] : component.element;
              if(firstEntryIsString) selectors.shift();
              $(delegate).delegate(handler, ...selectors);
            }else{
              $(element).on(handler, handlers[handler][element]);
            }
          }
        }
      }
    }
    removeHandlers(component){
      const handlers = component.handlers;
      for(let handler in handlers){
        if(handler === 'resize'){
          $(window).off();
        }else{
          for(element in handlers[handler]){
            if(element === 'delegate'){
              $(this.element).off(handler);
            }else{
              $(element).off(handler);
            }
          }
        }
      }
    }
    addToWebSocketQueue(handler){
      WebSocketQueue.add(handler);
    }
    validateName(name, min, max){
      const { checkNickname } = ComponentManager.state.config.regexp;
      return typeof name === 'string' && new RegExp(checkNickname).test(name) && name.length > min && name.length < max;
    }
    validateNumber(n, min, max){
      return Number.isInteger(n) && n >= min && n <= max;
    }
  }
};

const EventUtil = {
  handlers: {},
  events: {
    resize: ['resize'],
    click: ['click', 'touchend'],

    up: ['mouseup', 'touchend'],
    down: ['mousedown', 'touchstart'],
    move: ['mousemove'],
    change: ['change'],
  },
  addHandler: function(event, handler){
    const handlers = this.handlers;
    if(!handlers[event]) handlers[event] = [];
    handlers[event].push(handler);

    this.events[event].forEach(e => handler.element.element.addEventListener(e, handler.handler, false));
  },
  addDelegateHandler: function(event, element, selectors){
    const handlers = this.handlers[event];
    const index = handlers ? handlers.findIndex(handler => handler.element.compare(element.element)) : -1;
    if(index !== -1) {
      const addSelectors = selectors.filter(addSelector=>{
        for(let i = 0; i < handlers[index].selectors.length; i++){
          if(handlers[index].selectors[i][0] === addSelector[0]) return false;
        }
        return true;
      });
      selectors = [...handlers[index].selectors, ...addSelectors];
      this.removeHandler(event, element);
    }
    this.addHandler(event, {element, handler: e => selectors.forEach(selector=>element.within($(e.target), selector[0]) && selector[1].bind(e.target)(e)), selectors});
  },
  removeHandler: function(event, element){
    const remove = removableEvent => {
      const handlers = this.handlers[removableEvent];
      const index = handlers.findIndex(handler => handler.element.compare(element.element));
      if(index !== -1){
        const {element: el, handler: h} = handlers[index];
        this.events[removableEvent].forEach(e => el.element.removeEventListener(e, h, false));
        this.handlers[removableEvent].splice(index, 1);
      }
    };
    if(event) return remove(event);
    for(let handler in this.handlers){
      remove(handler);
    }
  },
};

const Transform = {
  elements: [],
  defaultStyles: {
    rotate: {
      value: 0,
      template: val => `rotate(${val}deg)`,
    },
    scale: {
      value: 1,
      template: val => `scale(${val})`,
    },
  },
  css: function(element, property, value=null){
    const isTransform = this.defaultStyles[property];
    const index = this.elements.findIndex(e => element.compare(e.element.element));
    if(isTransform && !value && value !== 0) return index === -1 ? this.getDefaultValues()[property] : this.elements[index].transform[property];
    if(!isTransform && !value && value !== 0) return false;
    if(!isTransform) return {property, value};

    let transformString = '';
    let transform = null;

    if(index === -1) {
      transform = {...this.getDefaultValues(), [property]: value};
      this.elements.push({element, transform});
    }else{
      this.elements[index].transform[property] = value;
      transform = this.elements[index].transform;
    }
    for(let prop in transform){
      transformString += this.defaultStyles[prop].template(transform[prop]);
    };
    return {property: 'transform', value: transformString};
  },
  getDefaultValues: function(){
    let styles = {};
    for(defaultStyle in this.defaultStyles){
      styles[defaultStyle] = this.defaultStyles[defaultStyle].value;
    }
    return styles;
  },
};

const effects = {
  linear: timeFraction => timeFraction,
  reverse: timeFraction => 1-timeFraction,
  quad: timeFraction => Math.pow(timeFraction, 2),
  circ: timeFraction => 1 - Math.sin(Math.acos(timeFraction)),
  swing: timeFraction => 0.5 - Math.cos( timeFraction * Math.PI ) / 2,
  reverseBounce: timeFraction => {
    for (let a = 0, b = 1; 1; a += b, b /= 2) {
      if (timeFraction >= (7 - 4 * a) / 11) {
        return -Math.pow((11 - 6 * a - 11 * timeFraction) / 4, 2) + Math.pow(b, 2)
      }
    }
  },
  bounce: function(timeFraction){return 1-this.reverseBounce(1-timeFraction)},
};

function $(selector, parent = document){
  const element = typeof selector === 'string' ? selector !== 'new' ? parent.querySelector(selector) : newNode(parent) : selector;

  function newNode(html){
    const newElement = document.createElement('div');
    newElement.innerHTML = html;
    return newElement;
  };

  return {
    element: element,
    selector: selector,
    animateStop: false,
    html: function(html=null){
      if(!html && html !== '') return this.element.innerHTML.trim();
      this.element.innerHTML = html;
      return this;
    },
    index: function(){
      const children = this.parent().children();

      for(let child in children) if(children[child].element === this.element){
        return child;
      }
    },
    eq: function(eq){
      return this.convertCollectionToArray(document.querySelectorAll(selector))[eq];
    },
    attr: function(name, value = null){
      if(!value && value !== '') return this.element.getAttribute(name);

      this.element.setAttribute(name, value);
      return this;
    },
    css: function(styles, value = null){
      if(value || value === 0){
        this.addStyles(styles, value);
        return this;
      }
      if(Array.isArray(styles)) {
        const computedStyles = getComputedStyle(this.element);
        let defaultStyles = {};
        styles.forEach(style => {
          const transform = Transform.css(this, style);
          const computedStyle = !transform && transform!==0 ? parseFloat(computedStyles.getPropertyValue(style)) : transform;
          defaultStyles[style] = !isNaN(computedStyle) ? computedStyle : null;
        });
        return defaultStyles;
      }
      for(let style in styles){
        this.addStyles(style, styles[style]);
      }
      return this;
    },
    addStyles: function(style, value){
      if(Array.isArray(this.element)) {
        this.element.forEach(e => {
          const {property, value: val} = Transform.css($(e), style, value);
          e.style[property] = val
        });
      }else{
        const {property, value: val} = Transform.css(this, style, value);
        this.element.style[property] = val;
      }
    },
    addClass: function(className){
      this.element.classList.add(className);
      return this;
    },
    removeClass: function(className){
      if(Array.isArray(this.element)) {
        this.element.forEach(e => e.classList.remove(className));
        return;
      }
      this.element.classList.remove(className);
      return this;
    },
    toggleClass: function(className){
      this.element.classList.toggle(className);
      return this;
    },
    hasClass: function(className){
      return this.element.classList.contains(className.slice(1));
    },
    within: function(element, selector){
      if(element.hasClass(selector) || element.tagName() === selector) return true;
      return this.element !== element.element && this.within(element.parent(), selector);
    },
    children: function(childSelector = null){
      return childSelector ? $(childSelector, this.element, this) : this.convertCollectionToArray(this.element.children);
    },
    parent: function(){
      return $(this.element.parentNode);
    },
    clone: function(cloneChildren = true){
      return $(this.element.cloneNode(cloneChildren));
    },
    append: function(html){
      const addedElement = this.node(html);
      if(Array.isArray(addedElement)){
        addedElement.forEach(child => this.element.appendChild(child));
      }else{
        this.element.appendChild(addedElement);
      }
      return this;
    },
    remove: function(){
      this.element.remove();
    },
    prepend: function(html){
      const addedElement = this.node(html);
      if(Array.isArray(addedElement)){
        addedElement.forEach((child,i) => i === 0 ? this.element.insertBefore(child, this.element.firstChild) : this.element.insertBefore(child, this.children()[i].element));
        return;
      }
      this.element.insertBefore(addedElement, this.element.firstChild);
    },
    animate: function(drawProperties, effectValue, duration, callback=null) {
      let start = performance.now();
      this.animateStop = false;

      const defaultStyles = this.css(Object.keys(drawProperties));

      const animate = time => {
        if(this.animateStop) return;
        let timeFraction = (time - start) / duration;
        if (timeFraction > 1) timeFraction = 1;
        let effect = effects[effectValue](timeFraction), customFunction = null;
        if(typeof drawProperties !== 'function'){
          for(let drawProperty in drawProperties){
            if(drawProperty === 'custom'){
              customFunction = drawProperties[drawProperty];
              continue;
            }
            let number = 0;
            let symbol = 0;
            const propertyValue = drawProperties[drawProperty];
            const defaulPropertyValue = defaultStyles[drawProperty];
            if(typeof propertyValue === 'number') {
              number = propertyValue;
            }else{
              const [num, sym] = drawProperties[drawProperty].split(':');
              number = parseFloat(num);
              symbol = sym;
            }

            let index = defaulPropertyValue < number ?
            number-(number-number*(defaulPropertyValue/number))*(1-effect) :
            defaulPropertyValue-(defaulPropertyValue-defaulPropertyValue*(number/defaulPropertyValue))*effect;

            if(customFunction){
              this.setTransform(drawProperty, index);
              customFunction(index);
            }else{
              this.css(drawProperty, index+symbol);
            }
          }
        }else{
          drawProperties(effect);
        }
        if(timeFraction < 1){
          requestAnimationFrame(animate);
          return;
        }
        if(callback) callback(this);
      }
      requestAnimationFrame(animate);
      return this;
    },
    fadeOut: function(time, effect = 'swing'){
      this.animate({opacity: 0}, effect, time, e => e.css('display', 'none'));
    },
    fadeIn: function(time, effect = 'swing'){
      this.css('display', 'block');
      this.animate({opacity: 1}, effect, time);
    },
    hide: function(){
      this.element.hidden = true;
      return this;
    },
    show: function(){
      this.element.hidden = false;
      return this;
    },
    on: function(event, handler){
      EventUtil.addHandler(event, {element: this, handler});
    },
    delegate: function(event, ...selectors){
      EventUtil.addDelegateHandler(event, this, selectors);
    },
    off: function(event = null){
      EventUtil.removeHandler(event, this);
      return this;
    },
    val: function(value = null){
      if(!value && value !== '') return this.element.value;
      this.element.value = value;
      return this;
    },
    node: function(html = null){
      const htmlObj = html ? typeof html === 'string' ? $('new', html) : html : this;
      return htmlObj.selector === 'new' ? [...htmlObj.element.children] : htmlObj.element;
    },
    offset: function(){
      const {offsetWidth, offsetHeight, offsetTop, offsetLeft} = this.element;
      return {width: offsetWidth, height: offsetHeight, top: offsetTop, left: offsetLeft};
    },
    client: function(){
      const {clientWidth, clientHeight, clientTop, clientLeft} = this.element;
      return {width: clientWidth, height: clientHeight, top: clientTop, left: clientLeft};
    },
    scroll: function(){
      const {scrollWidth, scrollHeight, scrollTop, scrollLeft} = this.element;
      return {width: scrollWidth, height: scrollHeight, top: scrollTop, left: scrollLeft};
    },
    rect: function(){
      const {top, right, bottom, left, width, height, x, y} = element.getBoundingClientRect();
      return {top, right, bottom, left, width, height, x, y};
    },
    outer: function(){
      let { width, height, top, left } = this.offset(), borderWidth = this.css(['border-width'])['border-width'];
      return { width: width+borderWidth*2, height: height+borderWidth*2, top: top+borderWidth, left: left+borderWidth };
    },
    convertCollectionToArray: function(collection){
      return [...collection].map(c => $(c));
    },
    all: function(){
      return $(this.selector[0] === '.' ? [...document.querySelectorAll(this.selector)] : this.element);
    },
    stop: function(){
      this.animateStop = true;
      return this;
    },
    tagName: function(){
      return this.element.tagName.toLowerCase();
    },
    compare: function(node){
      if(node == document || node == window) return this.element == node;
      if(this.element == document || this.element == window) return false;
      return this.element.isEqualNode(node);
    },
    replace: function(sp1, sp2){
      this.element.replaceChild(sp1.element, sp2.element);
      return this;
    },
    setTransform: function(style, value){
      Transform.css(this, style, value);
    },
    getTransform: function(style){
      return Transform.css(this, style);
    },
  };
};
