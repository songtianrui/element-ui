import throttle from 'throttle-debounce/debounce';
import {
  isHtmlElement,
  isFunction,
  isUndefined,
  isDefined
} from 'element-ui/src/utils/types';
import {
  getScrollContainer
} from 'element-ui/src/utils/dom';

const getStyleComputedProperty = (element, property) => {
  if (element === window) {
    element = document.documentElement;
  }

  if (element.nodeType !== 1) {
    return [];
  }
  // NOTE: 1 DOM access here
  const css = window.getComputedStyle(element, null);
  return property ? css[property] : css;
};

const entries = (obj) => {
  return Object.keys(obj || {})
    .map(key => ([key, obj[key]]));
};

const getPositionSize = (el, prop) => {
  return el === window || el === document
    ? document.documentElement[prop]
    : el[prop];
};

const getOffsetHeight = el => {
  return getPositionSize(el, 'offsetHeight');
};

const getClientHeight = el => {
  return getPositionSize(el, 'clientHeight');
};

const scope = 'ElInfiniteScroll';
const attributes = {
  delay: {
    type: Number,
    default: 200
  },
  distance: {
    type: Number,
    default: 0
  },
  disabled: {
    type: Boolean,
    default: false
  },
  immediate: {
    type: Boolean,
    default: true
  }
};

const getScrollOptions = (el, vm) => {
  if (!isHtmlElement(el)) return {};

  return entries(attributes).reduce((map, [key, option]) => {
    const { type, default: defaultValue } = option;
    let value = el.getAttribute(`infinite-scroll-${key}`);
    value = isUndefined(vm[value]) ? value : vm[value];
    switch (type) {
      case Number:
        value = Number(value);
        value = Number.isNaN(value) ? defaultValue : value;
        break;
      case Boolean:
        value = isDefined(value) ? value === 'false' ? false : Boolean(value) : defaultValue;
        break;
      default:
        value = type(value);
    }
    map[key] = value;
    return map;
  }, {});
};

const getElementTop = el => el.getBoundingClientRect().top;

const handleScroll = function(cb) {
  // 这里的this指向了 绑定了指令的元素  此元素有该指令添加的[scope] 属性;
  // ps: line:137
  const { el, vm, container, observer } = this[scope];
  const { distance, disabled } = getScrollOptions(el, vm);

  if (disabled) return;

  const containerInfo = container.getBoundingClientRect();
  if (!containerInfo.width && !containerInfo.height) return;

  let shouldTrigger = false;

  if (container === el) {
    console.log('container.scrollTop', container.scrollTop)
    //offsetHeight 包括 border
    // be aware of difference between clientHeight & offsetHeight & window.getComputedStyle().height
    const scrollBottom = container.scrollTop + getClientHeight(container);
    shouldTrigger = container.scrollHeight - scrollBottom <= distance;
    console.log('shouldTrigger', shouldTrigger)
  } else {
    const heightBelowTop = getOffsetHeight(el) + getElementTop(el) - getElementTop(container);
    const offsetHeight = getOffsetHeight(container);
    const borderBottom = Number.parseFloat(getStyleComputedProperty(container, 'borderBottomWidth'));
    shouldTrigger = heightBelowTop - offsetHeight + borderBottom <= distance;
  }

  if (shouldTrigger && isFunction(cb)) {
    cb.call(vm);
  } else if (observer) {
    observer.disconnect();
    this[scope].observer = null;
  }

};

export default {
  name: 'InfiniteScroll',
  inserted(el, binding, vnode) {
    const cb = binding.value;
    // 获取所在组件的上下文
    const vm = vnode.context;
    // 获取scollBox
    // only include vertical scroll
    const container = getScrollContainer(el, true);
    // 获取该指令传递的参数配置
    const { delay, immediate } = getScrollOptions(el, vm);
    // 节流 this绑定 (绑定了指令的元素)
    const onScroll = throttle(delay, handleScroll.bind(el, cb));

    el[scope] = { el, vm, container, onScroll };

    if (container) {
      container.addEventListener('scroll', onScroll);

      if (immediate) {
        // 设置observer : 观察dom变化 在内容没有撑满container情况下,触发回调函数
        const observer = el[scope].observer = new MutationObserver(onScroll);
        observer.observe(container, { childList: true, subtree: true });
        onScroll();
      }
    }
  },
  unbind(el) {
    const { container, onScroll } = el[scope];
    if (container) {
      container.removeEventListener('scroll', onScroll);
    }
  }
};

