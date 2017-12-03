goog.module('soccersub.Drag');

/**
 * @template Source,Target
 */
class Drag {
  /**
   * @param {!Element} div
   * @param {!function(!Event):?{source:!Source, label: string}} findSource
   * @param {!function(!Event):?{target:!Target, element: !Element}} findTarget
   * @param {!function(!Source, ?Target)} drop
   */
  constructor(div, findSource, findTarget, drop) {
    /** @private {!function(!Event):?{source:!Source, label: string}} */
    this.findSource_ = findSource;
    /** @private {!function(!Event):?{target:!Target, element:!Element}} */
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
    /** @private {?Element} */
    this.startElement_ = null;
    /** @private {?Target} */
    this.dragOverTarget_ = null;
    /** @private {?Element} */
    this.dragOverElement_ = null;
    /** @private {string} */
    this.saveBackgroundColor_ = '';
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
      const targetElement = this.findTarget_(e);
      if (targetElement) {
        this.startTarget_ = targetElement.target;
        this.startElement_ = targetElement.element;
      }
      this.dragVisual.style.display = 'block';
      this.dragText.textContent = srcLabel.label;
    }
  }

  dragMove(event) {
    //console.log('drag move: ' + event.clientX + ',' + event.clientY);
    if (!this.source_) {
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
        const targetElement = this.findTarget_(this.dragMoveEvent_);
        const target = targetElement ? targetElement.target : null;
        if (this.dragOverTarget_ != target) {
          if ((this.dragOverTarget_ != null) && 
              this.dragOverTarget_ != this.startTarget_) {
            this.dragOverElement_.style.backgroundColor = 
              this.saveBackgroundColor_;
          }
          this.dragOverTarget_ = target;
          this.dragOverElement_ = targetElement ? targetElement.element : null;
          if ((target != null) && target != this.startTarget_) {
            this.saveBackgroundColor_ = 
              this.dragOverElement_.style.backgroundColor || 'white';
            this.dragOverElement_.style.backgroundColor = 'green';
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
    if (this.source_) {
      const targetElement = this.findTarget_(e);
      const target = targetElement ? targetElement.target : null;
      this.drop_(this.source_, target);
      this.cleanupDrag();
    }
  }

  cleanupDrag() {
    if (this.dragOverElement_ && this.saveBackgroundColor_) {
      this.dragOverElement_.style.backgroundColor = this.saveBackgroundColor_;
    }
    this.dragMoveEvent_ = null;
    this.dragOverElement_ = null;
    this.dragOverTarget_ = null;
    this.dragVisual.style.display = 'none';
    this.saveBackgroundColor_ = '';
    this.source_ = null;
    this.startElement_ = null;
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
