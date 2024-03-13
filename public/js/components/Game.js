class Game extends Component('main'){
  constructor(){
    super();

    this.handlers = {
      resize: ()=>this.resize(),
      down: {
        delegate: [
          '#playerZone',
          ['.card', e=>this.dragCard(e)],
        ],
      },
      click:{
        '#getCard': e=>this.getCardButton(e),
        '#backToMainMenuButton': e=>this.backToMainMenuButton(e),
      },
    }

    this.cardAnimations = cardAnimations(this);

    this.wheelAnimation = null;

    this.activeStep = false;

    this.mode = 'Default';
    this.event = null;
    this.timer = null;
  }
  async init(){
    this.addToWebSocketQueue(async queue => {
      const { player, game, config } = this.getState(), { players, lastStep, lastCard, firstStep } = game, { guest } = config, members = this.setMembers();

      $('#getCard').append((await this.useCardImage('backside')).addClass('card'));
      $('#game').prepend(members.map(({id, authorized}) => this.useTemplate('GameSlot', { ...JSON.parse(authorized), alt: guest.picture })).join(''));
      this.resize();

      $('#game').css('opacity', 1);

      for(const [i, member] of members.entries()){
        for(let l = 0; l < member.cards; l++){
          await this.addCard('backside', $(`.opponents .card-zone`).eq(i), $('#getCard'));
        }
      }
      for(const card of this.getPlayer().cards){
        await this.addCard(card, $(`#playerZone .card-zone`), $('#getCard'));
      }

      await this.addCard(lastCard, $(`#wheel .card-zone`), $('#getCard'), false);

      if(firstStep){
        if(player.id == players[lastStep].id) this.sendCard(lastCard);
      }else{
        this.updatePlayground();
      }

      queue.end();
    });
  }
  endGame(winnerId){
    const { player, config } = this.getState(), { textInfo, gameOptions } = config, { cardAnimationSpeed } = gameOptions;
    $('#endGameZone .header').html(textInfo['10']);
    $('#endGameZone .winner').html(player.id == winnerId ? textInfo['11'] : textInfo['12']);
    $('#endGameZone').css('display', 'flex').animate({opacity: 1}, 'swing', cardAnimationSpeed);
  }

  async sayUno(){
    const { socket, config } = this.getState(), { cardAnimationSpeed } = config.gameOptions;

    const e = await this.useEventImage('sayUno');

    this.event = e;

    $('#uno').append(e).on('click', ()=>{
      this.offEvent();
      socket.emit('step', 'su');
    });

    const a = () => e.animate({scale: 0.7}, 'swing', cardAnimationSpeed*4, e=>e.animate({scale: 1}, 'bounce', cardAnimationSpeed*4, ()=>a()));a();
  }
  async didntSayUno(){
    const { socket, config } = this.getState(), { cardAnimationSpeed } = config.gameOptions;

    const e = await this.useEventImage('didntSayUno');

    this.event = e;

    $('#uno').append(e).on('click', ()=>{
      this.offEvent();
      socket.emit('step', 'du');
    });

    const a = () => e.animate({rotate: 20}, 'linear', cardAnimationSpeed*1.5, e=>e.animate({rotate: -20}, 'linear', cardAnimationSpeed*1.5, ()=>a()));a();
  }
  offEvent(){
    if(this.event){
      this.event.stop();
      this.event.parent().off().html('');
      this.event = null;
    }
  }

  step(step){
    this.addToWebSocketQueue(async queue => {
      const { player, game } = this.getState(), { id, isEvent, newCards, lastCard, lastStep, previousStep, lastUpdate, firstStep, direction, unoSaid, didntSayUnoStep } = step, nextPlayer = this.getNextPlayerById(id), thisPlayer = this.getPlayer();

      if(!isEvent && player.id != id && !firstStep){
        const cardZone = $(`.opponents .card-zone`).eq(this.getMemberIndex(id)),
              lastOpponentCard = cardZone.children();

        await this.addCard(lastCard, $(`#wheel .card-zone`), lastOpponentCard[lastOpponentCard.length-1], false, true);

        this.getPlayerById(id).cards--;

        this.sortCards(cardZone);
      }

      this.offEvent();

      if(newCards){
        if(Array.isArray(newCards)){
          this.getPlayer().cards.push(...newCards);
          for(const card of newCards){
            await this.addCard(card, $(`#playerZone .card-zone`), $('#getCard'));
          }
        }else{
          const p = didntSayUnoStep === false ? !isEvent ? nextPlayer : this.getPlayerById(id) : game.players[didntSayUnoStep];
          for(let i = 0; i < newCards; i++){
            await this.addCard('backside', $(`.opponents .card-zone`).eq(this.getMemberIndex(p.id)), $('#getCard'));
          }
          p.cards+=newCards;
        }
      }

      await this.cardAnimations.execute(step);

      this.setState({game: { ...game, lastCard, lastStep, lastUpdate, firstStep, direction }});
      this.setMembers();

      this.updatePlayground();

      this.activeStep = false;

      queue.end();
    });
  }

  backToMainMenuButton(e){
    e.preventDefault();
    const { socket } = this.getState();
    location.reload();
  }

  getCardButton(e){
    e.preventDefault();
    const { player, game, socket } = this.getState(), { players, lastCard, lastStep } = game;

    if(players[lastStep].id != player.id) return;
    socket.emit('step', 'tc');
  }

  getPlayer(){
    const { player, game } = this.getState(), { players } = game;
    return players[players.findIndex(({id})=>player.id==id)];
  }
  getPlayerById(id){
    const { players } = this.getState().game;
    return players[this.getPlayerIndex(id)];
  }
  getPlayerIndex(id){
    const { players } = this.getState().game;
    return players.findIndex(player => player.id == id);
  }
  getNextPlayerById(id){
    let { players, lastStep, direction } = this.getState().game;
    return direction ? players[lastStep+1] || players[0] : players[lastStep-1] || players[players.length-1];
  }

  setMembers(){
    const { player, game } = this.getState();
    const { players } = game;

    let index = this.getPlayerIndex(player.id), l = 0;
    const members = players.map((player, i) => index !== 0 && index !== players.length-1 ? players[index+i+1] ? players[index+i+1] : players[l++] : player).filter(p=> p.id != player.id);
    this.setState({game: {...game, members}});

    return members;
  }
  getMemberIndex(id){
    const { members } = this.getState().game;
    return members.findIndex(member => member.id == id);
  }

  updatePlayground(){
    const { player, game, config } = this.getState(), { players, lastCard, lastStep, direction } = game, { ttl, textInfo } = config, lastCardColor = lastCard[0], lastStepId = players[lastStep].id;

    if(!this.wheelAnimation) this.wheelAnimation = wheelAnimation(this);

    this.wheelAnimation.changeRotation(direction, lastCardColor);

    $('.resizable').all().removeClass('active');

    this.removeAllNotices();
    clearTimeout(this.timer);
    this.timer = setTimeout(()=>lastStepId != player.id && this.addNotice('GameOverProposalNotice', {text: textInfo['5']}), ttl.timeToStep*1000);

    if(lastStepId == player.id){
      $('#playerZone').addClass('active');
      return;
    }
    $('.opponents').eq(this.getMemberIndex(lastStepId)).addClass('active');
  }

  async dragCard(e){
    e.preventDefault();

    let card = $(e.target), player = this.getPlayer(), cardCode = this.getCardCodeById(card, player.id), cardIndex = card.index();

    if(!this.checkCardCode(cardCode)) return;

    const { top, left, scale } = this.getPositionRelativeToPlayground(card), newCard = await this.useCardImage(cardCode);
    $('#game').append(newCard.css({top: top+'px', left: left+'px', scale}).addClass('card'));
    card.css('opacity', 0);

    let y = e.clientY-top, x = e.clientX-left, currentDroppable = null, move = false;

    $(document).on('move', e => {
      e.preventDefault();
      move = true;

      newCard.css({ top: e.pageY-y+'px', left: e.pageX-x+'px' });

      newCard.hide();
      const shift = document.elementFromPoint(e.pageX, e.pageY);
      newCard.show();

      if(!shift) return;

      currentDroppable = shift.closest('#cardZone');
    });

    $(document).on('up', async e => {
      e.preventDefault();
      $(document).off();
      if(!this.activeStep && (currentDroppable || !move)){
        this.activeStep = true;

        newCard.css('opacity', 0);

        await this.addCard(cardCode, $('#wheel .card-zone'), newCard, false);

        player.cards.splice(cardIndex, 1);

        card.remove();

        this.sortCards($('#playerZone .card-zone'));

        this.sendCard(cardCode, cardIndex);
      }else{
        card.css('opacity', 1);
      }
      newCard.remove();
    });
  }

  addCard(card, block, from, sort = true, remove=false){
    const { cardAnimationSpeed } = this.getState().config.gameOptions;

    return new Promise(async resolve => {
      const newCard = (await this.useCardImage(card)).addClass('card').css('opacity', 0);

      this.wheelCleaning();

      block.append(newCard);

      if(sort) this.sortCards(block);

      const fromPosition = this.getPositionRelativeToPlayground(from);

      const cloneCard = newCard.clone().css({top: fromPosition.top+'px', left: fromPosition.left+'px', scale: fromPosition.scale, opacity: 1});
      $('#game').append(cloneCard);

      const newCardPosition = this.getPositionRelativeToPlayground(newCard);

      if(remove) from.remove();

      cloneCard.animate({ top: newCardPosition.top+':px', left: newCardPosition.left+':px', scale: newCardPosition.scale }, 'linear', cardAnimationSpeed, () => {
        newCard.css({ opacity: 1 });
        cloneCard.remove();
        resolve();
      });
    });
  }

  useCardImage(code){
    const { colorCodes, modes } = this.getState().config;
    const { regular, special, cardWithoutColor } = modes[this.mode];
    const { r, g, b, y, black } = colorCodes;

    const color = code[0], type = code[1];

    const cardTypeIsNumber = !isNaN(Number(type)), isSpecialCard = special.cards.indexOf(type) !== -1;

    let param = code === 'backside' ? [ code, {} ] : isSpecialCard ?
    [ type, { color: color == cardWithoutColor ? black : colorCodes[color], r,g,b,y } ] :
    [ cardTypeIsNumber ? 'r' : type, cardTypeIsNumber ? { color: colorCodes[color], number: type } : { color: colorCodes[color] } ];

    return new Promise(resolve=>this.useImage(param[0], param[1], card=>resolve($(card))));
  }

  useEventImage(e){
    return new Promise(resolve=>this.useImage(e, {}, e=>resolve($(e))));
  }

  sendCard(card, cardIndex = null){
    const { socket, config } = this.getState(), { colorCodes, gameOptions, modes } = config;

    if(card[0] === modes[this.mode].cardWithoutColor){
      const { cardAnimationSpeed } = gameOptions, choiceColorZone = $('#choiceColorZone'), wheel = $('#wheel .card-zone');
      choiceColorZone.children().forEach(choiceColor => {
        const color = choiceColor.attr('class').split(' ')[1];
        choiceColor.css({'background': colorCodes[color], 'box-shadow': `0 0 12px ${colorCodes[color]}`});
      });

      choiceColorZone.delegate('click', ['.choice-color', async e => {
        card = $(e.target).attr('class').split(' ')[1]+card[1];
        socket.emit('step', cardIndex ? card+':'+cardIndex : card);
        choiceColorZone.off().animate({ opacity: 0, scale: 0 }, 'swing', cardAnimationSpeed, e=>e.css('display', 'none'));

        const wheelCards = wheel.children();
        wheel.replace((await this.useCardImage(card)).addClass('card'), wheelCards[wheelCards.length-1]);
      }]);

      choiceColorZone.css({display: 'block', scale: 0}).animate({opacity: 1, scale: 1 }, 'swing', cardAnimationSpeed);
      return;
    }
    socket.emit('step', cardIndex ? card+':'+cardIndex : card);
  }

  sortCards(block){
    const sortCards = block.children(),
          cardZoneWidth = block.offset().width,
          isPlayerZone = block.parent().attr('id') === 'playerZone',
          numberOfCards = isPlayerZone ? this.getPlayer().cards.length : sortCards.length;

    if(sortCards.length === 0) return;

    const offsetLeft = sortCards[0].outer().width/2,
          cardsWidth = offsetLeft*(numberOfCards+1),
          align = cardsWidth > cardZoneWidth ? (cardsWidth - cardZoneWidth)/(numberOfCards-1) : 0,
          center = isPlayerZone && cardsWidth < cardZoneWidth ? cardZoneWidth/2-cardsWidth/2 : 0;

    for(let i = 0; i < sortCards.length; i++){
      sortCards[i].css({ left: (offsetLeft-align)*i+center+'px' });
    }
  }

  checkCardCode(code){
    const { player, game, config } = this.getState(),
    { cardWithoutColor } = config.modes[this.mode],
    { players, lastCard, lastStep } = game;

    if(players[lastStep].id != player.id) return false;

    let cardFit = false;

    for(const c of code){
      cardFit = lastCard.indexOf(c) !== -1;
      if (cardFit) break;
    }

    return cardFit || code.indexOf(cardWithoutColor) !== -1;
  }

  getCardCodeById(card, id){
    return this.getPlayerById(id).cards[card.index()];
  }

  getPositionRelativeToPlayground(block, firstBlock = null, grandParentScale = null, top = 0, left = 0){
    grandParentScale = grandParentScale || this.getGrandParentScale(block);
    const { block: scaleBlock, scale } = grandParentScale;

    if(block.attr('id') === 'game') return { top, left, scale };

    const outer = block.outer();

    const parentTop = !block.compare(scaleBlock.element) ? this.percentScale(outer.top, scale) : outer.top;
    const parentLeft = !block.compare(scaleBlock.element) ? this.percentScale(outer.left, scale) : outer.left;

    return this.getPositionRelativeToPlayground(block.parent(), firstBlock || block, grandParentScale, top+parentTop, left+parentLeft);
  }
  getGrandParentScale(block){
    const scale = block.css(['scale']).scale;
    if(scale !== 1) return { block, scale };
    return this.getGrandParentScale(block.parent());
  }
  wheelCleaning(){
    const { maxNumberOfCardsInTheWheel } = this.getState().config.gameOptions;

    const cards = $('#wheel .card-zone').children();
    if(cards.length >= 7) cards[0].remove();
  }

  resize(){
    const { game, config } = this.getState(),
          { offsetWidth, offsetHeight } = config.gameOptions;

          const numberOfPlayers = game.players.length-1,

                playgroundWidth = $('#game').offset().width,
                playgroundHeight = $('#game').offset().height,


                opponentsWidth = $('.opponents').offset().width,
                opponentsHeight = $('.opponents').offset().height+offsetHeight*2,

                opponetBlocksWidth = opponentsWidth*numberOfPlayers+numberOfPlayers*offsetWidth,


                cardZoneHeight = $('#cardZone').offset().height+offsetHeight,
                playerZoneHeight = $('#playerZone').offset().height+offsetHeight,
                mainZoneBlocksWidth = $('.mainZone').offset().width;


    const heightScale = playgroundHeight/(opponentsHeight+cardZoneHeight+playerZoneHeight);

    const opponentsScale = playgroundWidth <= this.percentScale(opponetBlocksWidth, heightScale) ? playgroundWidth/opponetBlocksWidth : heightScale;

    const mainZoneScale = playgroundWidth <= this.percentScale(mainZoneBlocksWidth, heightScale) ? playgroundWidth/mainZoneBlocksWidth : heightScale;

    const opponentsTop = this.percentScale(offsetHeight, opponentsScale),
          cardZoneTop = this.percentScale(opponentsHeight, opponentsScale),
          playerZoneTop = cardZoneTop+this.percentScale(cardZoneHeight, mainZoneScale);

    $('#cardZone').css('top', `${cardZoneTop}px`);
    $('#playerZone').css('top', `${playerZoneTop}px`);
    $('#endGameZone').css('top', `${playerZoneTop}px`);

    for(let i = 0; i < numberOfPlayers; i++){
      const playgroundSegment = playgroundWidth/numberOfPlayers,
            playgroundSegmentCenter = playgroundSegment/2-this.percentScale(opponentsWidth, opponentsScale)/2;
      $('.opponents').eq(i).css({scale: opponentsScale, top: `${opponentsTop}px`, left: `${playgroundSegment*i+playgroundSegmentCenter}px`, transition: '0.1s'});
    }
    $('.mainZone').all().css({scale: mainZoneScale, left: `${playgroundWidth/2-this.percentScale(mainZoneBlocksWidth, mainZoneScale)/2}px`, transition: '0.1s'});
  }
  percentScale(size, scale){
    return size*(scale*100)/100;
  }
};
