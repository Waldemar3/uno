function cardAnimations(game){
  return {
    d: async function({ lastCard }){
      const { colorCodes } = game.getState().config, color = lastCard[0];
      return [ $('#wheel .card-animation-zone'), await this.useCardElementImage({ color: colorCodes[color] }, 'changeDirection') ];
    },
    s: async function({ id, lastCard }){
      const { player, config } = game.getState(), { colorCodes } = config, color = lastCard[0], nextPlayerId = game.getNextPlayerById(id).id;
      return [ nextPlayerId != player.id ? $(`.opponents .card-animation-zone`).eq(game.getMemberIndex(nextPlayerId)) : $('#playerZone .card-animation-zone'), await this.useCardElementImage({ color: colorCodes[color] }, 'cancelStep') ];
    },
    p: async function({ id, isEvent, lastCard, newCards, didntSayUnoStep }){
      const { player, game: g, config } = game.getState(), { colorCodes } = config, color = lastCard[0], nextPlayerId = game.getNextPlayerById(id).id, newCardsIsArray = Array.isArray(newCards);
      return [ !newCardsIsArray ? $(`.opponents .card-animation-zone`).eq(game.getMemberIndex(didntSayUnoStep === false ? !isEvent ? nextPlayerId : id : g.players[didntSayUnoStep].id)) : $('#playerZone .card-animation-zone'), await this.useCardElementImage({ color: colorCodes[color], number: newCardsIsArray ? newCards.length : newCards }, 'newCards') ];
    },
    su: async function({ id }, img = 'sayUno'){
      return [ game.getState().player.id != id ? $(`.opponents .card-animation-zone`).eq(game.getMemberIndex(id)) : $('#playerZone .card-animation-zone'), await game.useEventImage(img) ];
    },
    du: async function(step){
      return await this.su(step, 'didntSayUno');
    },
    execute: async function(step){
      const { config } = game.getState(),
            { id, isEvent, newCards, lastCard, lastStep, lastUpdate, firstStep, direction } = step,
            animation = this[isEvent || lastCard[1]] || newCards && this['p'],
            speed = config.gameOptions.cardAnimationSpeed*2;

      if(!animation) return;

      const [ block, element ] = await animation.call(this, step);

      block.css({ display: 'flex', 'z-index': 99 }).append(element.addClass('card-animation').css({ display: 'block', rotate: 90,  scale: 0 })).animate({ opacity: 1 }, 'linear', speed, () => element.animate({ rotate: 0,  scale: 1 }, 'linear', speed, e => {
        setTimeout(() => {
          e.animate({ rotate: 90, scale: 0 }, 'linear', speed, () => {
            block.animate({ opacity: 0 }, 'linear', speed, e => e.css({ display: 'none', 'z-index': -99 }));
            e.remove();
          });
        }, speed);
      }));
    },
    useCardElementImage: function(props, type){
      return new Promise(resolve=>game.useImage(type, props, element=>resolve($(element))));
    },
  }
};
