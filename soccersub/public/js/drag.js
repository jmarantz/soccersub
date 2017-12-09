goog.module('soccersub.Drag');

/**
 * @template Source,Target
 */
class Drag {
  /**
   * @param {!Element} div
   * @param {!function(!Event):?{source:!Source, label: string}} findSource
   * @param {!function(!Event, !Source):?{target:!Target, elements: !Array<!Element>}} findTarget
   * @param {!function(!Source, ?Target)} drop
   */
  constructor(div, findSource, findTarget, drop) {
    /** @private {!function(!Event):?{source:!Source, label: string}} */
    this.findSource_ = findSource;
    /** @private {!function(!Event, !Source):?{target:!Target, elements: !Array<!Element>}} */
    this.findTarget_ = findTarget;
    /** @private {!function(!Source, ?Target)} */
    this.drop_ = drop;

    goog.events.listen(div, 'touchstart', this.dragStart, false, this);
    goog.events.listen(div, 'touchmove', this.dragMove, false, this);
    goog.events.listen(div, 'touchend', this.dragEnd, false, this);
    /** @private {?Source} */
    this.source_ = null;
    /** @private {?Event} */
    this.dragMoveEvent_ = null;
    /** @type {!Element} */
    this.dragVisual = goog.dom.getRequiredElement('drag-visual');
    /** @type {!Element} */
    this.dragText = goog.dom.getRequiredElement('drag-text');
    /** @private {?Target} */
    this.startTarget_ = null;
    /** @private {?Target} */
    this.dragOverTarget_ = null;
    /** @private {!Array<!Element>} */
    this.dragOverElements_ = [];
    /** @private {!Array<string>} */
    this.saveBackgroundColors_ = [];
  }

  /** @return {boolean} */
  active() {
    return this.source_ != null;
  }

  dragStart(e) {
    //console.log('drag start: ' + e.clientX + ',' + e.clientY);
    this.cleanupDrag();
    const srcLabel = this.findSource_(e);
    if (srcLabel) {
      this.source_ = srcLabel.source;
      const targetElements = this.findTarget_(e, srcLabel.source);
      if (targetElements) {
        this.startTarget_ = targetElements.target;
      }
      this.dragMove(e);
      this.dragVisual.style.display = 'block';
      this.dragText.textContent = srcLabel.label;
    }
  }

  dragMove(event) {
    //console.log('drag move: ' + event.clientX + ',' + event.clientY);
    if (this.source_ == null) {
      return;
    }

    if (!this.dragMoveEvent_) {
      window.requestAnimationFrame(() => {
        if (!this.dragMoveEvent_) {
          return;
        }
        const height = this.dragVisual.clientHeight;
        this.dragVisual.style.left = this.dragMoveEvent_.clientX + 'px';
        this.dragVisual.style.top = (this.dragMoveEvent_.clientY - height) + 'px';
        const targetElements = this.findTarget_(
          this.dragMoveEvent_, this.source_);
        const target = targetElements ? targetElements.target : null;
        if (this.dragOverTarget_ != target) {
          if ((this.dragOverTarget_ != null) && 
              this.dragOverTarget_ != this.startTarget_) {
            this.restoreBackgroundColors_();
          }
          this.dragOverTarget_ = target;
          this.dragOverElements_ = targetElements ? 
            targetElements.elements : [];
          if ((target != null) && target != this.startTarget_) {
            this.saveBackgroundColors_ = this.dragOverElements_.map(
              (element) => element.style.backgroundColor || 'white');
            for (const element of this.dragOverElements_) {
              element.style.backgroundColor = 'green';
            }
          }
        }
        this.dragMoveEvent_ = null;
      });
    }
    event.preventDefault();
    this.dragMoveEvent_ = event;
  }

  dragEnd(e) {
    //console.log('drag end: ' + e.clientX + ',' + e.clientY);
    if (this.source_ != null) {
      const targetElement = this.findTarget_(e, this.source_);
      const target = targetElement ? targetElement.target : null;
      this.drop_(this.source_, target);
      this.cleanupDrag();
    }
  }

  /** @private */
  restoreBackgroundColors_() {
    for (let i = 0; i < this.saveBackgroundColors_.length; ++i) {
      this.dragOverElements_[i].style.backgroundColor = 
        this.saveBackgroundColors_[i];
    }
    this.saveBackgroundColors_ = [];
  }

  cleanupDrag() {
    this.restoreBackgroundColors_();
    this.dragMoveEvent_ = null;
    this.dragOverElements_ = [];
    this.dragOverTarget_ = null;
    this.dragVisual.style.display = 'none';
    this.source_ = null;
    this.startTarget_ = null;
      
    /*
    if (this.dragElement_) {
      goog.style.setOpacity(this.dragElement, 1.0);
      this.dragElement = null;
    }
    */
  }
}

exports = Drag;
