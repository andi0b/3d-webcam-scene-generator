HTMLElement.prototype.showPopover = function () { this.style.display = 'block'; };
HTMLElement.prototype.hidePopover = function () { this.style.removeProperty('display'); };
Element.prototype.getAnimations = () => [];
Element.prototype.scrollIntoView = function () {};
Element.prototype.checkVisibility = () => true;
Element.prototype.getClientRects = () => [];
document.elementFromPoint = () => null;
document.elementsFromPoint = () => [];
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
