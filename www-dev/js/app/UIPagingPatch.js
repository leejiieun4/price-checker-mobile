define(['chui'], function($) {

    $.UIPaging = function ( ) {
        var currentArticle = $('.segmented.paging').closest('nav').next();
        if (window && window.jQuery && $ === window.jQuery) {
            if ($('.segmented.paging').hasClass('horizontal')) {
                currentArticle.addClass('horizontal');
            } else if ($('.segmented.paging').hasClass('vertical')) {
                currentArticle.addClass('vertical');
            }
        } else {
            if ($('.segmented.paging').hasClass('horizontal')[0]) {
                currentArticle.addClass('horizontal');
            } else if ($('.segmented.paging').hasClass('vertical')[0]) {
                currentArticle.addClass('vertical');
            }
        }
        currentArticle.children().eq(0).addClass('current');
        currentArticle.children().eq(0).siblings().addClass('next');
        var sections = function() {
            return currentArticle.children().length;
        }

        $('.segmented.paging').on($.eventStart, '.button:first-of-type', function() {
            if (sections() === 1) return
            var me = $(this);
            me.next().removeClass('selected');
            me.addClass('selected');
            var currentSection;
            currentSection = $('section.current');
            if (currentSection.index() === 0)  {
                currentSection.removeClass('current');
                currentArticle.children().eq(sections() - 1).addClass('current').removeClass('next');
                currentArticle.children().eq(sections() - 1).siblings().removeClass('next').addClass('previous');
            } else {
                currentSection.removeClass('current').addClass('next');
                currentSection.prev().removeClass('previous').addClass('current');
            }

            setTimeout(function() {
                me.removeClass('selected');
            }, 500);
        });
        $('.segmented.paging').on($.eventStart, '.button:last-of-type', function() {
            if (sections() === 1) return
            var me = $(this);
            me.prev().removeClass('selected');
            me.addClass('selected');
            var currentSection;
            if (this.classList.contains('disabled')) return;
            currentSection = $('section.current');
            if (currentSection.index() === sections() - 1) {
                // start again!
                currentSection.removeClass('current');
                currentArticle.children().eq(0).addClass('current').removeClass('previous');
                currentArticle.children().eq(0).siblings().removeClass('previous').addClass('next');
            } else {
                currentSection.removeClass('current').addClass('previous');
                currentSection.next().removeClass('next').addClass('current');
            }
            setTimeout(function() {
                me.removeClass('selected');
            }, 250);
        });
    }


    $.UIDeletable = function ( options ) {
       /*
          options = {
             list: selector,
             editLabel : labelName || Edit,
             doneLabel : labelName || Done,
             deleteLabel : labelName || Delete,
             placement: left || right,
             callback : callback
          }
       */
       if (!options || !options.list || !options instanceof Array) {
          return;
       }
       var list = options.list;
       var editLabel = options.editLabel || 'Edit';
       var doneLabel = options.doneLabel || 'Done';
       var deleteLabel = options.deleteLabel || 'Delete';
       var placement = options.placement || 'right';
       var callback = options.callback || $.noop;
       var deleteButton;
       var editButton;
       var deletionIndicator;
       // Windows uses an icon for the delete button:
       if ($.isWin) deleteLabel = '';
       if (!$.doneCallbacks) {
          $.doneCallbacks = {};
       }
       var setupDeletability = function(callback) {
          var deleteSlide;
          if ($.isiOS) {
             deleteSlide = '100px';
          } else if ($.isAndroid) {
             deleteSlide = '140px';
          }

          $(function() {
              if (!$.doneCallbacks[callback]) {
                  $.doneCallbacks[callback] = true;
                  $.body.on('singletap', '.edit', function() {
                    var $this = this;
                    setTimeout(function() {
                       $this.classList.remove('edit');
                       $this.classList.add('done');
                       $($this).text(doneLabel);
                       $(list).addClass('showIndicators');
                    });
                  });
                  $.body.on('singletap', '.done', function() {
                    var $this = this;
                    setTimeout(function() {
                       $this.classList.remove('done');
                       $this.classList.add('edit');
                       $($this).text(editLabel);
                       $(list).removeClass('showIndicators');
                       $(list).find('li').removeClass('selected');
                    });
                  });
                  $.body.on('singletap', '.deletion-indicator', function() {
                    if ($(this).closest('li')[0].classList.contains('selected')) {
                       $(this).closest('li').removeClass('selected');
                       return;
                    } else {
                       $(this).closest('li').addClass('selected');
                    }
                  });
              }

             if ($.isiOS || $.isSafari) {
                $(list).on('swiperight singletap', 'li', function() {
                   $(this).removeClass('selected');
                });
             }
             $(list).on('singletap', '.delete', function() {
                var $this = this;
                $(this).siblings().css({'-webkit-transform': 'translate3d(-1000%,0,0)', '-webkit-transition': 'all 1s ease-out'});
                setTimeout(function() {
                   callback.call(callback, $this);
                   $($this).parent().remove();
                   if ($(list).children().length === 0) {
                      $this = $(list).closest('article').prev().find('.done');
                      $this.removeClass('done').addClass('edit');
                      $($this).text(editLabel);
                      $(list).removeClass('showIndicators');
                      $(list).find('li').removeClass('selected');
                   }
                }, 500);
             });
          });
       };
       var cachedList = $(list);
       if (cachedList[0].classList.contains('deletable')) {
          return;
       }
       deleteButton = $.concat('<a href="javascript:void(null)" class="button delete">', deleteLabel, '</a>');
       editButton = $.concat('<a href="javascript:void(null)" class="button edit">', editLabel, '</a>');
       deletionIndicator = '<span class="deletion-indicator"></span>';
       var old = cachedList.closest('article').prev();
       if (old && old.find) {
          old.find('.edit').remove();
          old.find('.done').remove();
       }
       if (placement === 'left') {
          cachedList.closest('article').prev().prepend(editButton);
       } else {
          cachedList.closest('article').prev().append(editButton);
          cachedList.closest('article').prev().find('h1').addClass('buttonOnRight');
          cachedList.closest('article').prev().find('.edit').addClass('align-flush');
       }
       cachedList.find('li').prepend(deletionIndicator);
       cachedList.find('li').append(deleteButton);
       $('li').find('.delete').each(function(ctx, idx) {
          if (window && window.jQuery && $ === window.jQuery) ctx = idx;
          if ($.isiOS || $.isSafari) $(ctx).css({height: '100%'});
       });
       setupDeletability(callback);

       cachedList.addClass('deletable');
       return cachedList;
    }

    $.UIGoBack = function () {
       var histLen = $.UINavigationHistory.length;
       if (histLen > 1) {
           var currentArticle = $('article.current');
           var destination = $($.UINavigationHistory[histLen-2]);
           var currentToolbar;
           var destinationToolbar;
           if (window && window.jQuery && $ === window.jQuery) {
              if (currentArticle.next().hasClass('toolbar')) {
                 currentToolbar = currentArticle.next('toolbar');
              }
              if (destination.next().hasClass('toolbar')) {
                 destinationToolbar = destination.next('toolbar');
              }
           } else {
              currentToolbar = currentArticle.next().hasClass('toolbar');
              destinationToolbar = destination.next().hasClass('toolbar');
           }
           currentToolbar.removeClass('current').addClass('next');
           destinationToolbar.removeClass('previous').addClass('current');

           destination.removeClass('previous').removeClass('next').addClass('current');
           destination.prev().removeClass('previous').removeClass('next').addClass('current');
           currentArticle.removeClass('current').addClass('next');
           currentArticle.prev().removeClass('current').addClass('next');
           $.UISetHashOnUrl($.UINavigationHistory[histLen-2]);
           if ($.UINavigationHistory[histLen-1] !== $.firstArticle[0].id) {
              $.UINavigationHistory.pop();
           }
        }
    };

    $.UITabbar = function ( options ) {
         /*
         var options = {
            id: 'mySpecialTabbar',
            tabs: 4,
            labels: ["Refresh", "Add", "Info", "Downloads", "Favorite"],
            icons: ["refresh", "add", "info", "downloads", "favorite"],
            selected: 2
         }
         */
         if (!options) return;
         $.body.addClass('hasTabBar');
         if ($.isiOS6) $.body.addClass('isiOS6');
         var id = options.id || $.Uuid();
         var selected = options.selected || '';
         var tabbar = '<div class="tabbar" id="' + id + '">';
         var icon = ($.isiOS || $.isSafari) ? '<span class="icon"></span>' : '';
         for (var i = 0; i < options.tabs; i++) {
            tabbar += '<a class="button ' + options.icons[i];
            if (selected === i+1) {
               tabbar += ' selected';
            }
            tabbar += '">' + icon + '<label>' + options.labels[i] + '</label></a>';
         }
         tabbar += '</div>';
         $.body.append(tabbar);
         $('nav').removeClass('current').addClass('next');
         $('nav').eq(selected).removeClass('next').addClass('current');
         $('article').removeClass('current').addClass('next');
         $('article').eq(selected-1).removeClass('next').addClass('current');
         $.body.find('.tabbar').on('singletap', '.button', function() {
            var $this = this;
            var index;
            var id;
            $this.classList.add('selected');
            $(this).siblings('a').removeClass('selected');
            index = $(this).index();
            $('article.previous').removeClass('previous').addClass('next');
            $('nav.previous').removeClass('previous').addClass('next');
            $('article.current').removeClass('current').addClass('next');
            $('nav.current').removeClass('current').addClass('next');
            id = $('article').eq(index)[0].id;
            $.UISetHashOnUrl('#'+id);
            if ($.UINavigationHistory[0] === ('#' + id)) {
               $.UINavigationHistory = [$.UINavigationHistory[0]];
            } else if ($.UINavigationHistory.length === 1) {
               if ($.UINavigationHistory[0] !== ('#' + id)) {
                  $.UINavigationHistory = ['#'+id];
               }
            } else if($.UINavigationHistory.length === 3) {
               $.UINavigationHistory.pop();
            } else {
               $.UINavigationHistory[1] = '#'+id;
            }
            $('article').eq(index).removeClass('next').addClass('current');
            $('nav').eq(index+1).removeClass('next').addClass('current');
         });
      }
});