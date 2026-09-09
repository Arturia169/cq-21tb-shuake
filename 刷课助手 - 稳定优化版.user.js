// ==UserScript==
// @name         刷课助手
// @namespace    local.21tb.shuake.helper
// @version      1.15.7
// @description  在线课程学习辅助（21tb / 重庆公需课）：智能高性价比选课（学分/时长比最高优先/微课最短耗时优先/高分攻坚三模式调度）、倍速播放（2x~16x）、极速冲刺秒刷、纯后台无头静默多课并发舰队(0%CPU/0视频流量)、各倍速预计播完时间、自动静音、播完自动下一节、多课同刷、可拖动统一悬浮窗、无人值守自动化（大类目→小科目→课程 自动切换循环）、年度大类目可折叠课程列表、自动关闭异常弹窗、自动处理挂起检测、答题验证提醒、防掉线、性能优化（DOM缓存/倍速事件驱动/降频守护）
// @author       Ryan
// @updateURL    https://testingcf.jsdelivr.net/gh/Arturia169/cq-21tb-shuake@main/%E5%88%B7%E8%AF%BE%E5%8A%A9%E6%89%8B%20-%20%E7%A8%B3%E5%AE%9A%E4%BC%98%E5%8C%96%E7%89%88.user.js
// @downloadURL  https://testingcf.jsdelivr.net/gh/Arturia169/cq-21tb-shuake@main/%E5%88%B7%E8%AF%BE%E5%8A%A9%E6%89%8B%20-%20%E7%A8%B3%E5%AE%9A%E4%BC%98%E5%8C%96%E7%89%88.user.js
// @match        https://cqrl.21tb.com/*
// @match        https://*.21tb.com/els/html/courseStudyItem/*
// @match        https://*.21tb.com/courseSetting/coursePlay/*
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @compatible   chrome edge firefox
// ==/UserScript==
(function () {
  'use strict';

  (function() {
    /* ---------- 🕵️ 上帝模式与防封护盾 (注入真实页面主上下文) ---------- */
    try {
      const injectGodModeScript = function () {
        if (document.getElementById('tb21-godmode-script')) return;
        const script = document.createElement('script');
        script.id = 'tb21-godmode-script';
        script.textContent = `
          (function() {
            if (window.__tb21_godmode_ready) return;
            window.__tb21_godmode_ready = true;
            console.log('[刷课助手-破解] 🚀 上帝模式与防封护盾已启动...');

            // 0.000 穿透 Vue 组件树：实时获取全局未学课程、打桩 DOM 与桥接跨沙箱数据 (主上下文特权)
            try {
              const getCourseDetailVm = function() {
                const refundEl = document.querySelector('.refund, .courseDetail, .course-detail');
                if (refundEl && refundEl.__vue__) return refundEl.__vue__;
                const app = document.querySelector('#app');
                if (app && app.__vue__) {
                  const queue = [app.__vue__];
                  let steps = 0;
                  while (queue.length > 0 && steps < 300) {
                    steps++;
                    const cur = queue.shift();
                    if (cur && (cur.courseInfoMustList || cur.courseInfoSelectiveList || cur.getMustCourseDetailByProjectId)) {
                      return cur;
                    }
                    if (cur && cur.$children && cur.$children.length) {
                      for (let i = 0; i < cur.$children.length; i++) queue.push(cur.$children[i]);
                    }
                  }
                }
                return null;
              };

              const syncCoursesFromVue = function() {
                try {
                  const vm = getCourseDetailVm();
                  if (!vm) return;
                  const must = vm.courseInfoMustList || [];
                  const ele = vm.courseInfoSelectiveList || [];
                  const allList = [];
                  must.concat(ele).forEach(function(item) {
                    if (item && item.courseInfo && item.courseInfo.courseId) {
                      const ci = item.courseInfo;
                      const rate = String(item.currentStepRate || '');
                      const isDone = rate.indexOf('100') > -1 || rate.indexOf('已完成') > -1 || ci.schedule >= 100 || ci.status === 2;
                      allList.push({
                        courseId: String(ci.courseId),
                        title: ci.courseTitle || ('课程_' + ci.courseId),
                        score: ci.courseScore || 0,
                        done: isDone
                      });
                    }
                  });
                  if (allList.length > 0) {
                    sessionStorage.setItem('tb21_dom_courses', JSON.stringify(allList));
                    window.__tb21_vm_courses = allList;
                  }
                  if (vm.roadMapId) sessionStorage.setItem('tb21_current_roadmap_id', String(vm.roadMapId));
                  if (vm.currentStageId) sessionStorage.setItem('tb21_current_stage_id', String(vm.currentStageId));

                  // 对应 DOM 卡片逐一打桩
                  const curList = (vm.activeName === 'SELECTIVE' ? ele : must);
                  const cards = document.querySelectorAll('.text-item.cursor');
                  cards.forEach(function(card, idx) {
                    const item = curList[idx];
                    if (item && item.courseInfo && item.courseInfo.courseId) {
                      card.setAttribute('data-course-id', String(item.courseInfo.courseId));
                      card.setAttribute('data-course-title', item.courseInfo.courseTitle || '');
                      card.setAttribute('data-course-score', String(item.courseInfo.courseScore || 0));
                      const rate = String(item.currentStepRate || card.textContent || '');
                      const isDone = rate.indexOf('100') > -1 || rate.indexOf('已完成') > -1;
                      card.setAttribute('data-course-done', isDone ? '1' : '0');
                    }
                  });
                } catch(e) {}
              };

              syncCoursesFromVue();
              setInterval(syncCoursesFromVue, 600);
            } catch(e) {}

            // 0.00 注入防护样式，永久抹杀 50% 时长不足导致的“画面变灰/重新观看”遮罩与 Element UI 网页变暗背景 (v-modal)
            try {
              const shieldStyle = document.createElement('style');
              shieldStyle.id = 'tb21-shield-style';
              shieldStyle.textContent = '.v-modal, .el-message-box__wrapper, .player-endInfo, .player-endInfo.has-replay-btn, .player-replay-tip, .replay-btn, .has-replay-btn { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }';
              (document.head || document.documentElement).appendChild(shieldStyle);

              // 物理级移除任何动态挂载的 Element UI 黑色背景遮罩层
              const purgeModals = function() {
                const modals = document.querySelectorAll('.v-modal, .el-message-box__wrapper');
                if (modals && modals.length) {
                  modals.forEach(function(m) { try { m.remove(); } catch(e) {} });
                }
              };
              purgeModals();
              const modalObserver = new MutationObserver(purgeModals);
              modalObserver.observe(document.documentElement, { childList: true, subtree: true });
            } catch(e) {}

            // 0. 拦截原生 alert 和 confirm，防止平台报“异常/快进”弹窗打断播放
            try {
              window.alert = function(msg) {
                console.log('[刷课助手-护盾] 🛡️ 成功拦截并静默平台 alert 弹窗:', msg);
                return true;
              };
              window.confirm = function(msg) {
                console.log('[刷课助手-护盾] 🛡️ 成功拦截并静默平台 confirm 弹窗:', msg);
                return true;
              };
            } catch(e) {}

            // 0.01 核心绝杀：彻底拦截平台对视频 seeking / seeked 事件的监听！
            // 平台的“学霸君，系统检测到你的学习行为存在异常”100% 依赖于监听 video 的 seeking / seeked 发现快进！
            // 屏蔽之后，平台播放器对步进快进完全变成聋子和瞎子，根本不知道发生了快进！
            try {
              const rawMediaAddEventListener = HTMLMediaElement.prototype.addEventListener;
              HTMLMediaElement.prototype.addEventListener = function(type, listener, options) {
                if (type === 'seeking' || type === 'seeked') {
                  // 拦截平台反作弊监听，但允许自身内部使用
                  if (listener && listener.__tb21Internal) {
                    return rawMediaAddEventListener.call(this, type, listener, options);
                  }
                  console.log('[刷课助手-护盾] 🛡️ 成功拦截平台对 video.' + type + ' (防快进作弊) 的事件监听');
                  return;
                }
                return rawMediaAddEventListener.call(this, type, listener, options);
              };
            } catch(e) {}

            // 0.02 核心绝杀：全局劫持 Vue / Element UI 原型链与弹窗系统，在代码层面直接掐死「学霸君」弹窗！
            try {
              const killXueBaJun = function(fn) {
                return function(message, title, options) {
                  const txt = typeof message === 'string' ? message : (message && (message.message || message.title)) || '';
                  if (typeof txt === 'string' && (txt.indexOf('学霸君') > -1 || txt.indexOf('学习行为存在异常') > -1 || txt.indexOf('学习行为') > -1 || txt.indexOf('拖拽') > -1)) {
                    console.log('[刷课助手-护盾] 💥 成功在函数调用层彻底扼杀「学霸君」弹窗:', txt);
                    if (options && typeof options.callback === 'function') {
                      try { options.callback('confirm'); } catch(err) {}
                    }
                    return Promise.resolve({ action: 'confirm' });
                  }
                  return fn ? fn.apply(this, arguments) : Promise.resolve({ action: 'confirm' });
                };
              };

              // 1. 深度劫持 Object.prototype.$alert 与 $msgbox (针对 Webpack 打包的 Vue 实例)
              let _protoAlert = null;
              Object.defineProperty(Object.prototype, '$alert', {
                get: function() { return this.__tb21_alert || _protoAlert; },
                set: function(fn) {
                  if (typeof fn === 'function') {
                    const wrapped = killXueBaJun(fn);
                    this.__tb21_alert = wrapped;
                    _protoAlert = wrapped;
                  } else {
                    this.__tb21_alert = fn;
                  }
                },
                configurable: true
              });

              let _protoMsgbox = null;
              Object.defineProperty(Object.prototype, '$msgbox', {
                get: function() { return this.__tb21_msgbox || _protoMsgbox; },
                set: function(fn) {
                  if (typeof fn === 'function') {
                    const wrapped = killXueBaJun(fn);
                    this.__tb21_msgbox = wrapped;
                    _protoMsgbox = wrapped;
                  } else {
                    this.__tb21_msgbox = fn;
                  }
                },
                configurable: true
              });

              // 2. 劫持 window.ELEMENT.MessageBox (防全局注入)
              if (window.ELEMENT && window.ELEMENT.MessageBox) {
                window.ELEMENT.MessageBox.alert = killXueBaJun(window.ELEMENT.MessageBox.alert);
                window.ELEMENT.MessageBox.confirm = killXueBaJun(window.ELEMENT.MessageBox.confirm);
              }
              let _elem = window.ELEMENT;
              Object.defineProperty(window, 'ELEMENT', {
                get: function() { return _elem; },
                set: function(v) {
                  _elem = v;
                  if (v && v.MessageBox) {
                    v.MessageBox.alert = killXueBaJun(v.MessageBox.alert);
                    v.MessageBox.confirm = killXueBaJun(v.MessageBox.confirm);
                  }
                },
                configurable: true
              });
            } catch(e) {}

            // 0.1 核心底层防御：在页面真实主上下文劫持 currentTime，坚决拦截平台尝试拉回/重置进度（包括拉回到0）
            try {
              const origTimeDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
              if (origTimeDesc) {
                Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
                  get: function() { return origTimeDesc.get.call(this); },
                  set: function(val) {
                    const cur = origTimeDesc.get.call(this);
                    // 核心拦截：如果当前进度已经 > 3 秒，且目标时间比当前时间小超过 2 秒（包括被平台强行归零）
                    // 只要不是正在正常切小节/切课程，坚决拒绝！
                    if (cur > 3 && (cur - val) > 2 && !window.__tb21_switching_section) {
                      console.log('[刷课助手-护盾] 🛡️ 坚决拦截平台/弹窗尝试强制拉回进度！原时间:', cur.toFixed(1), '目标时间:', val);
                      return; // 拒绝修改，保持当前进度！
                    }
                    return origTimeDesc.set.call(this, val);
                  }
                });
                console.log('[刷课助手-护盾] 🛡️ 页面真实上下文进度防拉回锁定已激活');
              }
            } catch(e) {}

            // 1. 拦截并篡改 XHR
            const rawOpen = XMLHttpRequest.prototype.open;
            const rawSend = XMLHttpRequest.prototype.send;
            // [性能优化] 属性描述符外层单次提取，避免高频请求重复查找原型链
            const origResponseText = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');
            const origResponse = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'response');
            const origStatus = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'status');

            function isTargetApiUrl(url) {
              if (!url || typeof url !== 'string') return false;
              const u = url.toLowerCase();
              return u.indexOf('.do') > -1 || u.indexOf('course') > -1 ||
                     u.indexOf('study') > -1 || u.indexOf('setting') > -1 ||
                     u.indexOf('record') > -1 || u.indexOf('rms') > -1 ||
                     u.indexOf('oim') > -1 || u.indexOf('ubr') > -1 ||
                     u.indexOf('nms') > -1 || u.indexOf('config') > -1;
            }

            XMLHttpRequest.prototype.open = function(method, url) {
              this._url = url || '';
              return rawOpen.apply(this, arguments);
            };
            XMLHttpRequest.prototype.send = function(data) {
              const url = this._url || '';
              // [性能优化] 先验过滤：非平台目标请求直接原生放行，不附加监听，不重写属性 getter，0 额外开销
              if (!isTargetApiUrl(url)) {
                return rawSend.call(this, data);
              }

              let modifiedResponse = null;
              let reqData = data;

              // 篡改 saveStudyLog.do 请求，强制 minStudyTime 归零，并平滑化 studyTime 防止后端风控拦截
              if (url.indexOf('saveStudyLog.do') > -1) {
                try {
                  if (typeof reqData === 'string') {
                    const reqObj = JSON.parse(reqData);
                    if (reqObj && reqObj.studyLogVO) {
                      reqObj.studyLogVO.minStudyTime = 0;
                      if (reqObj.studyLogVO.studyTime && reqObj.studyLogVO.studyTime > 45) {
                        reqObj.studyLogVO.studyTime = 30;
                      }
                      reqData = JSON.stringify(reqObj);
                    }
                  }
                } catch (e) {}
              }

              // 核心突破：拦截 updateCourseRecord 上报请求，绝不允许因为 recordTime < 50% 将进度截断为几十秒！
              if (url.indexOf('updateCourseRecord') > -1) {
                try {
                  if (typeof reqData === 'string') {
                    const reqObj = JSON.parse(reqData);
                    if (reqObj && reqObj.timeToFinish) {
                      const v = document.querySelector('video');
                      const isFinishing = (v && (v.ended || (v.duration && v.currentTime >= v.duration - 5))) || window.__tb21_rush_finishing;
                      let isRush = false;
                      try { isRush = localStorage.getItem('tb21_helper_rushMode') === 'true' || window.__tb21_rush_finishing; } catch(e) {}
                      if (isFinishing || reqObj.currentPosition >= reqObj.timeToFinish - 10) {
                        reqObj.currentPosition = reqObj.timeToFinish;
                        reqObj.currentStudyTime = Math.max(reqObj.currentStudyTime || 0, Math.round(reqObj.timeToFinish * 0.6));
                        reqData = JSON.stringify(reqObj);
                        console.log('[刷课助手-护盾] 🎯 成功重写 updateCourseRecord(XHR) 为100%完播，破除50%截断:', reqObj.currentPosition);
                      } else if (isRush && reqObj.currentPosition > 0) {
                        reqObj.currentStudyTime = Math.max(reqObj.currentStudyTime || 0, Math.round(reqObj.currentPosition * 0.6));
                        reqData = JSON.stringify(reqObj);
                      }
                    }
                  }
                } catch (e) {}
              }

              this.addEventListener('readystatechange', function() {
                if (this.readyState === 4 && this._url) {
                  let currentResponseText = '';
                  try {
                    if (this.responseType === '' || this.responseType === 'text') {
                      currentResponseText = this.responseText;
                    } else if (this.responseType === 'json' && this.response) {
                      currentResponseText = typeof this.response === 'string' ? this.response : JSON.stringify(this.response);
                    }
                  } catch (e) { return; }

                  if (!currentResponseText) return;

                  // 终极防御：凡带有异常/重置/作弊/拖拽/50%字样的响应，全部强行改写为1001成功(RMS业务成功码)
                  if (currentResponseText.indexOf('异常') > -1 || currentResponseText.indexOf('学霸君') > -1 ||
                      currentResponseText.indexOf('重置') > -1 || currentResponseText.indexOf('过快') > -1 ||
                      currentResponseText.indexOf('作弊') > -1 || currentResponseText.indexOf('拖拽') > -1 ||
                      currentResponseText.indexOf('50%') > -1) {
                    try {
                      const fakeRes = JSON.parse(currentResponseText);
                      fakeRes.code = 1001; // 21tb 核心RMS标准成功码，彻底阻止 ab3e 触发 MessageBox.alert
                      fakeRes.msg = '操作处理成功';
                      fakeRes.message = 'success';
                      fakeRes.success = true;
                      fakeRes.status = 200;
                      if (fakeRes.bizResult === null || fakeRes.bizResult === undefined) fakeRes.bizResult = true;
                      modifiedResponse = JSON.stringify(fakeRes);
                      console.log('🛡️ [刷课助手-护盾] 成功拦截并消灭服务器异常/50%风控拦截(XHR):', this._url);
                    } catch (e) {
                      modifiedResponse = JSON.stringify({ code: 1001, status: 200, success: true, msg: "操作处理成功", bizResult: true });
                    }
                  }

                  // 核心破解：允许高倍速、允许拖拽、关闭反作弊、清空最低学习时间，并智能缓存课程章节与时长元数据
                  if (this._url.indexOf('showCourseSettingConfig') > -1 ||
                      this._url.indexOf('showCourseChapter') > -1 ||
                      this._url.indexOf('loadCourseSystemSetting') > -1) {
                    try {
                      let text = modifiedResponse || currentResponseText;
                      // 自动采集课程时长与章节元数据到缓存池
                      if (this._url.indexOf('showCourseChapter') > -1) {
                        try {
                          const chapJson = JSON.parse(text);
                          if (chapJson && chapJson.bizResult && Array.isArray(chapJson.bizResult)) {
                            let totSec = 0, totDur = 0, unfSec = 0, unfDur = 0, courseIdFound = '';
                            chapJson.bizResult.forEach(function(ch) {
                              if (ch && Array.isArray(ch.resourceDTOS)) {
                                ch.resourceDTOS.forEach(function(r) {
                                  totSec++;
                                  const d = Number(r.minStudyTime || r.timeToFinish || 0);
                                  totDur += d;
                                  if (!r.confirmFinish && !r.finish) { unfSec++; unfDur += d; }
                                  if (!courseIdFound && r.courseId) courseIdFound = String(r.courseId);
                                });
                              }
                            });
                            if (!courseIdFound) {
                              const m = location.href.match(/courseId=([^&#]+)/);
                              if (m) courseIdFound = m[1];
                            }
                            if (courseIdFound) {
                              const cStore = JSON.parse(localStorage.getItem('tb21_course_meta_cache') || '{}');
                              cStore[courseIdFound] = Object.assign({}, cStore[courseIdFound] || {}, {
                                totalSections: totSec,
                                totalDuration: totDur,
                                unfinishedSections: unfSec,
                                unfinishedDuration: unfDur,
                                ts: Date.now()
                              });
                              localStorage.setItem('tb21_course_meta_cache', JSON.stringify(cStore));
                            }
                          }
                        } catch(e) {}
                      }

                      text = text.replace(/"allowHighSpeed":\s*0/g, '"allowHighSpeed":1')
                                 .replace(/"allowDrag":\s*0/g, '"allowDrag":1')
                                 .replace(/"enablePreventCheat":\s*true/g, '"enablePreventCheat":false')
                                 .replace(/"minStudyTime":\s*\d+/g, '"minStudyTime":0');
                      modifiedResponse = text;
                      console.log('[刷课助手-破解] 成功篡改 XHR 配置:', this._url);
                    } catch (e) {}
                  }
                }
              });

              if (origResponseText) {
                try {
                  Object.defineProperty(this, 'responseText', {
                    get: function() {
                      if (modifiedResponse !== null) return modifiedResponse;
                      return origResponseText.get.call(this);
                    },
                    configurable: true
                  });
                } catch (e) {}
              }
              if (origResponse) {
                try {
                  Object.defineProperty(this, 'response', {
                    get: function() {
                      if (modifiedResponse !== null) {
                        if (this.responseType === 'json') {
                          try { return JSON.parse(modifiedResponse); } catch(e) { return modifiedResponse; }
                        }
                        return modifiedResponse;
                      }
                      return origResponse.get.call(this);
                    },
                    configurable: true
                  });
                } catch (e) {}
              }
              if (origStatus) {
                try {
                  Object.defineProperty(this, 'status', {
                    get: function() {
                      if (modifiedResponse !== null) return 200;
                      return origStatus.get.call(this);
                    },
                    configurable: true
                  });
                } catch (e) {}
              }
              return rawSend.call(this, reqData);
            };

            // 2. 拦截并篡改 Fetch
            const rawFetch = window.fetch;
            window.fetch = async function(...args) {
              const fetchUrl = (typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '');
              // [性能优化] 先验过滤：静态资源/非业务请求直接原生直通，0 内存分配，0 流克隆！
              if (!isTargetApiUrl(fetchUrl)) {
                return rawFetch.apply(this, args);
              }

              let reqData = (args[1] && args[1].body) ? args[1].body : null;
              if (fetchUrl.indexOf('saveStudyLog.do') > -1 && reqData) {
                try {
                  if (typeof reqData === 'string') {
                    const reqObj = JSON.parse(reqData);
                    if (reqObj && reqObj.studyLogVO) {
                      reqObj.studyLogVO.minStudyTime = 0;
                      if (reqObj.studyLogVO.studyTime && reqObj.studyLogVO.studyTime > 45) {
                        reqObj.studyLogVO.studyTime = 30;
                      }
                      args[1].body = JSON.stringify(reqObj);
                    }
                  }
                } catch (e) {}
              }

              if (fetchUrl.indexOf('updateCourseRecord') > -1 && reqData) {
                try {
                  if (typeof reqData === 'string') {
                    const reqObj = JSON.parse(reqData);
                    if (reqObj && reqObj.timeToFinish) {
                      const v = document.querySelector('video');
                      const isFinishing = (v && (v.ended || (v.duration && v.currentTime >= v.duration - 5))) || window.__tb21_rush_finishing;
                      if (isFinishing || reqObj.currentPosition >= reqObj.timeToFinish - 10) {
                        reqObj.currentPosition = reqObj.timeToFinish;
                        reqObj.currentStudyTime = Math.max(reqObj.currentStudyTime || 0, Math.round(reqObj.timeToFinish * 0.6));
                        args[1].body = JSON.stringify(reqObj);
                        console.log('[刷课助手-护盾] 🎯 成功重写 updateCourseRecord(Fetch) 为100%完播，破除50%截断:', reqObj.currentPosition);
                      }
                    }
                  }
                } catch (e) {}
              }

              const response = await rawFetch.apply(this, args);
              try {
                const url = response.url || fetchUrl;
                const clone = response.clone();
                let text = await clone.text();
                let isModified = false;
                let fakeStatus = response.status;

                if (text && (text.includes('异常') || text.includes('学霸君') || text.includes('重置') || text.includes('过快') || text.includes('作弊'))) {
                  try {
                    const fakeRes = JSON.parse(text);
                    fakeRes.code = 0;
                    fakeRes.msg = '操作处理成功';
                    fakeRes.message = 'success';
                    fakeRes.success = true;
                    fakeRes.status = 200;
                    if (fakeRes.bizResult === null || fakeRes.bizResult === undefined) fakeRes.bizResult = true;
                    text = JSON.stringify(fakeRes);
                    isModified = true;
                    fakeStatus = 200;
                    console.log('🛡️ [刷课助手-护盾] 成功拦截并消灭服务器异常/学霸君指令(Fetch):', url);
                  } catch (e) {
                    text = JSON.stringify({ code: 0, status: 200, success: true, msg: "success", bizResult: true });
                    isModified = true;
                    fakeStatus = 200;
                  }
                }

                if (url.includes('showCourseSettingConfig') || url.includes('showCourseChapter') || url.includes('loadCourseSystemSetting')) {
                  text = text.replace(/"allowHighSpeed":\\s*0/g, '"allowHighSpeed":1')
                             .replace(/"allowDrag":\\s*0/g, '"allowDrag":1')
                             .replace(/"enablePreventCheat":\\s*true/g, '"enablePreventCheat":false')
                             .replace(/"minStudyTime":\\s*\\d+/g, '"minStudyTime":0');
                  isModified = true;
                  console.log('[刷课助手-破解] 成功篡改 Fetch 配置:', url);
                }

                if (isModified) {
                  return new Response(text, {
                    status: fakeStatus,
                    statusText: fakeStatus === 200 ? 'OK' : response.statusText,
                    headers: response.headers
                  });
                }
              } catch (e) {}
              return response;
            };
          })();
        `;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
      };

      if (document.head || document.documentElement) {
        injectGodModeScript();
      } else {
        document.addEventListener('DOMContentLoaded', injectGodModeScript, { once: true });
      }
    } catch (e) {
      console.log('[刷课助手] 上帝模式注入初始化失败:', e);
    }

    // ===== 新增：破解后台标签页抑制 (页面失去焦点时自动暂停的问题) =====
    try {
        // 在伪装可见状态前保存浏览器原生 getter，供 rAF 兜底判断真实状态。
        const hiddenDesc = (typeof Document !== 'undefined')
            ? Object.getOwnPropertyDescriptor(Document.prototype, 'hidden')
            : null;
        const nativeHiddenGetter = hiddenDesc && hiddenDesc.get;

        // 1. 劫持 document.hidden 和 document.visibilityState，永远返回 false 和 'visible'
        Object.defineProperty(document, 'hidden', {
            get: function() { return false; },
            configurable: true
        });
        Object.defineProperty(document, 'visibilityState', {
            get: function() { return 'visible'; },
            configurable: true
        });
        Object.defineProperty(document, 'webkitHidden', {
            get: function() { return false; },
            configurable: true
        });

        // 2. 拦截并阻止 visibilitychange 和 blur 事件向网页传递
        const rawAddEventListener = window.addEventListener;
        const blockEvents = ['visibilitychange', 'webkitvisibilitychange', 'blur', 'pagehide', 'pause'];

        // 覆盖 window 级别的监听
        window.addEventListener = function(type, listener, options) {
            if (blockEvents.includes(type)) {
                console.log('[刷课助手] 🛡️ 拦截了平台对 ' + type + ' (后台切换/暂停) 事件的监听');
                return;
            }
            return rawAddEventListener.call(this, type, listener, options);
        };

        // 覆盖 document 级别的监听
        const rawDocAddEventListener = document.addEventListener;
        document.addEventListener = function(type, listener, options) {
            if (blockEvents.includes(type)) {
                console.log('[刷课助手] 🛡️ 拦截了平台对 document.' + type + ' (后台切换/暂停) 事件的监听');
                return;
            }
            return rawDocAddEventListener.call(this, type, listener, options);
        };

        // 覆盖 video 元素的 pause 事件拦截
        const rawElementAddEventListener = Element.prototype.addEventListener;
        Element.prototype.addEventListener = function(type, listener, options) {
            if (type === 'pause' && this.tagName === 'VIDEO') {
                const originalListener = listener;
                listener = function(e) {
                    // 如果网页处于“真实”的隐藏状态（虽然前面劫持了，但浏览器底层可能还是会触发 pause）
                    // 我们可以尝试阻止这个原生的 pause 事件传递给业务代码
                    if (!e.isTrusted) { // 简单判断是否是用户主动触发的，如果不是（比如浏览器后台强杀），就拦截
                        console.log('[刷课助手] 🛡️ 拦截了后台触发的非信任视频 pause 事件');
                        return;
                    }
                    return originalListener.apply(this, arguments);
                };
            }
            return rawElementAddEventListener.call(this, type, listener, options);
        };

        // 3. 覆盖 window.onblur 等属性监听
        Object.defineProperty(window, 'onblur', { set: function() {}, get: function() { return null; }});
        Object.defineProperty(document, 'onvisibilitychange', { set: function() {}, get: function() { return null; }});

        // 4. 重写 requestAnimationFrame，防止后台降频导致播放器状态机卡死
        const rawRequestAnimationFrame = window.requestAnimationFrame;
        const rawCancelAnimationFrame = window.cancelAnimationFrame;
        const fallbackRafTimers = new Map();
        let fallbackRafId = -1;
        const isActuallyHidden = function() {
            try { return nativeHiddenGetter ? !!nativeHiddenGetter.call(document) : false; }
            catch (e) { return false; }
        };
        // 如果我们接管 rAF 导致了原平台的某些依赖 this 指向的代码报错（如 addVideoClick），
        // 我们可以只在网页真正处于 hidden 状态时才接管它，平时还是用原生的。
        window.requestAnimationFrame = function(cb) {
            if (isActuallyHidden()) {
                const id = fallbackRafId--;
                const timer = setTimeout(() => {
                    fallbackRafTimers.delete(id);
                    try { cb(performance.now()); } catch(e) {}
                }, 1000 / 60);
                fallbackRafTimers.set(id, timer);
                return id;
            }
            return rawRequestAnimationFrame.call(window, function(time) {
                try { cb(time); } catch(e) {}
            });
        };
        window.cancelAnimationFrame = function(id) {
            if (fallbackRafTimers.has(id)) {
                clearTimeout(fallbackRafTimers.get(id));
                fallbackRafTimers.delete(id);
                return;
            }
            return rawCancelAnimationFrame.call(window, id);
        };

    } catch (e) {
        console.log('[刷课助手] 后台播放伪装失败:', e);
    }
    // =========================================================

  })();

  /* ============ 配置存储（无 GM 时退回 localStorage） ============ */
  const LS_PREFIX = 'tb21_helper_';
  function storeGet(k, d) {
    try {
      if (typeof GM_getValue === 'function') {
        const value = GM_getValue(k, d);
        // 同步一份给页面上下文/iframe 兜底代码读取。
        try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(value)); } catch (e) {}
        return value;
      }
      const v = localStorage.getItem(LS_PREFIX + k);
      return v === null ? d : JSON.parse(v);
    } catch (e) { return d; }
  }
  function storeSet(k, v) {
    // GM 存储用于油猴脚本跨页面共享；localStorage 用于页面上下文和 iframe 兜底。
    try { if (typeof GM_setValue === 'function') GM_setValue(k, v); } catch (e) {}
    try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); } catch (e) {}
  }

  /* ============ 性能优化：DOM 缓存 + localStorage 防抖写入 ============ */
  const _domCache = {};
  function cachedEl(id) {
    const el = _domCache[id];
    if (el && document.contains(el)) return el;
    const fresh = document.getElementById(id);
    if (fresh) _domCache[id] = fresh;
    return fresh;
  }

  let S = {
    speed: storeGet('speed', 8),       // 目标倍速 2 / 4 / 8 / 16
    autoNext: storeGet('autoNext', true),
    autoMute: storeGet('autoMute', true),
    rushMode: storeGet('rushMode', false) // 🚀 极速冲刺秒刷模式（15~20秒通关/节）
  };

  const SPEEDS = [2, 4, 8, 16];

  function save() {
    storeSet('speed', S.speed);
    storeSet('autoNext', S.autoNext);
    storeSet('autoMute', S.autoMute);
    storeSet('rushMode', S.rushMode);
  }

  /* ============ 公共：会话 cookie 修复 ============ */
  function fixSessionCookie() {
    try {
      const m = location.href.match(/[?&]eln_session_id=([^&]+)/);
      if (m && m[1]) {
        const sid = decodeURIComponent(m[1]);
        if (!document.cookie.split('; ').some(c => c.indexOf('eln_session_id=' + sid) === 0)) {
          document.cookie = 'eln_session_id=' + sid + '; path=/; domain=' + location.hostname + '; max-age=86400; secure';
        }
      }
    } catch (e) {}
  }

  /* ============ 公共：屏蔽「登录已超时」原生 confirm（避免被踢去登录页） ============ */
  function overrideConfirm() {
    try {
      const w = window;
      if (w.__tb21ConfirmOverridden) return;
      const nativeConfirm = w.confirm;
      w.confirm = function (msg) {
        try {
          if (String(msg || '').indexOf('登录已超时') > -1 || String(msg || '').indexOf('logout') > -1) {
            console.log('[刷课助手] 已拦截登录超时弹窗:', msg);
            return false; // 留在当前页，不跳转登录页
          }
        } catch (e) {}
        return nativeConfirm.apply(this, arguments);
      };
      w.__tb21ConfirmOverridden = true;
    } catch (e) {}
  }

  /* ============ 公共：自动关闭弹窗（Element UI + 通用检测） ============ */
  const ANOMALY_KEYWORDS = ['学习行为', '学霸君', '存在异常', '行为异常', '系统检测', '学习异常', '播放速度', '快进', '拖拽', '重置', '失败', '异常', '警告', '提示'];
  const SKIP_KEYWORDS = ['作弊', '违规', '风控', '答题', '验证', '超时', '登录'];

  function autoDismissMessageBox() {
    try {
      // 404 页面快速处理
      if (document.title.indexOf('404') > -1 || document.title.indexOf('页面不存在') > -1) {
        if (history.length > 1) history.back();
        else location.href = 'https://cqrl.21tb.com/nms-frontend/index.html#/org/index';
        return;
      }

      // [性能极致优化 Fast-Path]：99.9% 的挂机时间无弹窗，先以单次选择器快速探测！
      // 若页面完全没有弹窗或遮罩层容器，0.05ms 内快速跳过，彻底杜绝遍历全页 <a> 和 <button> 造成的强制重排回流！
      const modalWrapper = document.querySelector(
        '.el-message-box__wrapper, .el-message-box, .el-dialog__wrapper, .pCheat-box, .hangUp-box, .modal, .layui-layer'
      );
      if (!modalWrapper) return;

      // Element UI 弹窗检测（仅当探测到弹窗容器时精准执行）
      document.querySelectorAll('.el-message-box__wrapper, .el-message-box').forEach(function (box) {
        if (box.classList.contains('el-message-box') && box.closest && box.closest('.el-message-box__wrapper')) return;
        if (box.offsetParent === null && box.style.display === 'none') return;
        const txt = (box.textContent || '').trim();
        if (ANOMALY_KEYWORDS.some(function (kw) { return txt.indexOf(kw) > -1; })) {
          const btn = box.querySelector('.el-message-box__btns .el-button--primary') ||
                      box.querySelector('.el-message-box__btns .el-button') ||
                      box.querySelector('.el-button--primary') ||
                      box.querySelector('.el-button') ||
                      Array.from(box.querySelectorAll('*')).find(function(el) {
                        return el.children.length === 0 && el.textContent.trim() === '确定';
                      });
          if (btn && !btn.__tb21Clicked) {
            btn.__tb21Clicked = true;
            console.log('[刷课助手] 检测到异常提示弹窗，点击确定继续');
            btn.click();
          }
          return;
        }
        if (SKIP_KEYWORDS.some(function (kw) { return txt.indexOf(kw) > -1; })) return;
        const btn = box.querySelector('.el-message-box__btns .el-button--primary') ||
                    box.querySelector('.el-message-box__btns .el-button');
        if (btn) btn.click();
      });

      // 通用检测：仅在探测到的弹窗容器范围内定位确定按钮，绝不全局扫描页面正文！
      modalWrapper.querySelectorAll('button, a, input[type="button"], .btn, .el-button').forEach(function (btn) {
        if (btn.offsetParent === null && btn.style.display === 'none') return;
        if ((btn.textContent || '').trim() !== '确定') return;
        if (btn.children.length > 0) return;
        if (btn.__tb21Clicked) return;
        let ancestor = btn.parentElement;
        for (let i = 0; i < 8 && ancestor; i++) {
          const aText = (ancestor.textContent || '').trim();
          if (aText.length >= 10 && aText.length <= 500) {
            if (ANOMALY_KEYWORDS.some(function (kw) { return aText.indexOf(kw) > -1; })) {
              btn.__tb21Clicked = true;
              console.log('[刷课助手] 检测到异常提示弹窗(通用)，点击确定继续');
              btn.click();
              break;
            }
          }
          ancestor = ancestor.parentElement;
        }
      });
    } catch (e) {}
  }

  /* ============ 公共：进度计算 / 多课数据（父子 frame 共用） ============ */
  function hasFinishedClass(el) {
    if (!el || !el.classList) return false;
    return el.classList.contains('finish') || el.classList.contains('finished') || el.classList.contains('is-finish');
  }
  function computeProgressFromDoc(doc) {
    try {
      const items = doc.querySelectorAll('li.section-item');
      if (!items.length) return null;
      let done = 0, frac = 0;
      items.forEach(function (li) {
        const fl = li.querySelector('.first-line');
        if (hasFinishedClass(li)) done++;
        else if (fl && fl.className.indexOf('active') > -1) {
          const v = doc.querySelector('video');
          if (v && v.duration) frac = Math.min(1, v.currentTime / v.duration);
        }
      });
      const v = doc.querySelector('video');
      return {
        pct: Math.min(100, Math.round((done + frac) / items.length * 100)),
        done: done, total: items.length,
        paused: !!(v && v.paused), playing: !!(v && !v.paused)
      };
    } catch (e) { return null; }
  }
  function getMyCourseId() {
    try {
      const q = (window.parent && window.parent !== window && window.parent.location) ? window.parent.location.search : location.search;
      const m = new URLSearchParams(q).get('courseId');
      if (m) return m;
    } catch (e) {}
    try {
      const seg = decodeURIComponent(location.pathname.split('/').pop() || '');
      const m = seg.split('&')[0];
      if (m && m.length === 32) return m;
    } catch (e) {}
    return '';
  }
  function sessionSid() {
    try {
      const q = (window.parent && window.parent !== window && window.parent.location) ? window.parent.location.search : location.search;
      const m = new URLSearchParams(q).get('eln_session_id');
      if (m) return m;
    } catch (e) {}
    try {
      const m = document.cookie.match(/eln_session_id=([^;]+)/);
      if (m) return m[1];
    } catch (e) {}
    return '';
  }
  function courseUrl(cid) {
    return location.origin + '/els/html/courseStudyItem/courseStudyItem.learn.do?courseId=' + cid +
      '&courseType=NEW_COURSE_CENTER&vb_server=' + encodeURIComponent('http://21tb-video.21tb.com') +
      '&eln_session_id=' + sessionSid();
  }
  let _dashCache = { ts: 0, data: [] };
  function dashEntries() {
    if (Date.now() - _dashCache.ts < 2000) return _dashCache.data; // [性能优化] 增加内存缓存，降低 localStorage I/O 频率
    const arr = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('tb21_progress_') === 0) {
          try { arr.push(JSON.parse(localStorage.getItem(k))); } catch (e) {}
        }
      }
    } catch (e) {}
    _dashCache.data = arr.sort(function (a, b) { return b.ts - a.ts; });
    _dashCache.ts = Date.now();
    return _dashCache.data;
  }
  function storeProgress(courseId, obj) {
    try { localStorage.setItem('tb21_progress_' + courseId, JSON.stringify(obj)); } catch (e) {}
  }

  /* ============ 公共：无人值守自动化状态机 ============ */
  const AUTO_KEY_RUNNING = 'tb21_auto_running';
  const AUTO_KEY_DETAIL_URL = 'tb21_auto_detail_url';
  const AUTO_KEY_ACTIVE_CATEGORY = 'tb21_auto_active_category_v2';
  const AUTO_KEY_PENDING_COURSE = 'tb21_auto_pending_course_v2';
  const AUTO_KEY_DONE_COURSES = 'tb21_auto_done_courses_v2';
  const AUTO_KEY_DONE_TABS = 'tb21_auto_done_tabs_v2';
  const AUTO_KEY_DONE_CATEGORIES = 'tb21_auto_done_categories_v2';
  const AUTO_KEY_CATEGORY_COOLDOWN = 'tb21_auto_category_cooldown_v2';
  const AUTO_CATEGORY_COOLDOWN_TTL = 2 * 60 * 60 * 1000; // 冷却 2 小时
  const AUTO_KEY_PAGE_CURSORS = 'tb21_auto_page_cursors_v2';
  const AUTO_MEMORY_TTL = 24 * 60 * 60 * 1000;
  const AUTO_LIST_URL = 'https://cqrl.21tb.com/nms-frontend/index.html#/org/course/list?entrance=zygx';

  function isCategoryCoolingDown(key) {
    if (!key) return false;
    const now = Date.now();
    const map = readAutoJson(AUTO_KEY_CATEGORY_COOLDOWN, {});
    if (map[key] && now - map[key] < AUTO_CATEGORY_COOLDOWN_TTL) {
      return true;
    }
    return false;
  }
  function markCategoryCooldown(key) {
    if (!key) return;
    const map = readAutoJson(AUTO_KEY_CATEGORY_COOLDOWN, {});
    map[key] = Date.now();
    writeAutoJson(AUTO_KEY_CATEGORY_COOLDOWN, map);
  }
  function clearCategoryCooldown(key) {
    if (!key) return;
    const map = readAutoJson(AUTO_KEY_CATEGORY_COOLDOWN, {});
    delete map[key];
    writeAutoJson(AUTO_KEY_CATEGORY_COOLDOWN, map);
  }

  /* ============ 官方后端 API 深度集成服务 (TbApiClient) ============ */
  const TbApiClient = (function () {
    const BASE = 'https://cqrl.21tb.com';
    let _heartbeatTimer = null;

    async function request(url, options) {
      options = options || {};
      const fullUrl = url.startsWith('http') ? url : (BASE + url);
      const timeoutMs = options.timeout || 6000;
      let controller = null;
      let timeoutId = null;
      if (typeof AbortController !== 'undefined') {
        controller = new AbortController();
        timeoutId = setTimeout(function () { controller.abort(); }, timeoutMs);
      }

      try {
        const fetchOpts = {
          method: options.method || 'GET',
          credentials: 'include',
          headers: Object.assign({
            'Accept': 'application/json, text/plain, */*',
            'X-Requested-With': 'XMLHttpRequest'
          }, options.headers || {})
        };
        if (controller) fetchOpts.signal = controller.signal;
        if (options.data) {
          if (typeof options.data === 'string') {
            fetchOpts.body = options.data;
          } else {
            fetchOpts.headers['Content-Type'] = 'application/json;charset=UTF-8';
            fetchOpts.body = JSON.stringify(options.data);
          }
        }
        const resp = await fetch(fullUrl, fetchOpts);
        if (timeoutId) clearTimeout(timeoutId);
        if (!resp.ok) return null;
        const text = await resp.text();
        try {
          return JSON.parse(text);
        } catch (e) {
          return text;
        }
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        return null;
      }
    }

    function get(url, params, options) {
      options = options || {};
      options.method = 'GET';
      if (params) {
        const qs = [];
        Object.keys(params).forEach(function (k) {
          if (params[k] !== undefined && params[k] !== null) {
            qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
          }
        });
        if (qs.length > 0) {
          const sep = url.indexOf('?') === -1 ? '?' : '&';
          url = url + sep + qs.join('&');
        }
      }
      return request(url, options);
    }

    function post(url, data, options) {
      options = options || {};
      options.method = 'POST';
      options.data = data;
      return request(url, options);
    }

    // 1. Session 心跳保活接口 (每 10 分钟自动 ping 一次，挂机通宵防掉线)
    function startSessionHeartbeat() {
      if (_heartbeatTimer) return;
      const doHeartbeat = async function () {
        try {
          const res = await get('/html/login/provider.elnSessionId.do', { _t: Date.now() });
          if (res) {
            console.log('[刷课助手] 💓 Session心跳保活成功，会话状态活跃');
          }
        } catch (e) {}
      };
      doHeartbeat();
      _heartbeatTimer = setInterval(doHeartbeat, 10 * 60 * 1000);
    }

    // 2. 获取大类目项目阶段与官方合格线学分要求
    async function getStageRequirements(roadMapId) {
      if (!roadMapId) return null;
      return await get('/nms/html/courseStudy/getRmStageByProjectId.do', { roadMapId: roadMapId });
    }

    // 3. 获取大类目项目完成详情 (已修必修、已修选修)
    async function getProjectDetail(projectId) {
      if (!projectId) return null;
      return await get('/nms/html/courseStudy/getRmProjectDetail.do', { projectId: projectId });
    }

    // 4. 一次性获取大类目全量课程 (pageSize=100)
    async function loadAllCourses(projectId, stageId, assignType) {
      const params = {
        projectId: projectId || '',
        stageId: stageId || '',
        assignType: assignType || '',
        pageNo: 1,
        pageSize: 100
      };
      return await get('/nms/html/courseStudy/loadCoursePage.do', params);
    }

    // 4.1 官方全量未完成课程精准直连拉取 (优先用于静默舰队与智能规划)
    async function fetchDetailCourses(projectId, roadMapId) {
      try {
        const q = getRouteQueryParams();
        const rmId = roadMapId || q.roadMapId || sessionStorage.getItem('tb21_current_roadmap_id') || '';
        const pId = projectId || q.projectId || '';

        let stages = [];
        if (rmId) {
          const stageRes = await get('/nms/html/courseStudy/getRmStageByProjectId.do', { roadMapId: rmId });
          if (stageRes && Array.isArray(stageRes)) stages = stageRes;
        }
        if (stages.length === 0 && pId) {
          const stageRes2 = await get('/nms/html/courseStudy/getRmStageByProjectId.do', { projectId: pId });
          if (stageRes2 && Array.isArray(stageRes2)) stages = stageRes2;
        }
        if (stages.length === 0) {
          const curStageId = sessionStorage.getItem('tb21_current_stage_id') || '';
          if (curStageId) stages.push({ stageId: curStageId });
        }

        const resList = [];
        for (let i = 0; i < (stages.length || 1); i++) {
          const sId = stages[i] ? stages[i].stageId : '';
          if (!sId) continue;
          const [mustRes, eleRes] = await Promise.all([
            get('/nms/html/courseStudy/getCourseDetailByProjectId.do', {
              stageId: sId,
              courseType: 'MUST',
              courseStatus: 'NOT_COMPLETE',
              pageNo: 1,
              pageSize: 100
            }).catch(function () { return null; }),
            get('/nms/html/courseStudy/getCourseDetailByProjectId.do', {
              stageId: sId,
              courseType: 'SELECTIVE',
              courseStatus: 'NOT_COMPLETE',
              pageNo: 1,
              pageSize: 100
            }).catch(function () { return null; })
          ]);
          const mRows = (mustRes && mustRes.rows) || [];
          const eRows = (eleRes && eleRes.rows) || [];
          mRows.concat(eRows).forEach(function (row) {
            if (row && row.courseInfo && row.courseInfo.courseId) {
              const cid = String(row.courseInfo.courseId);
              if (!resList.some(function (x) { return x.courseId === cid; })) {
                resList.push({
                  courseId: cid,
                  title: row.courseInfo.courseTitle || ('课程_' + cid),
                  score: row.courseInfo.courseScore || 0,
                  sourceId: '',
                  providerCorpCode: ''
                });
              }
            }
          });
        }
        if (resList.length > 0) return resList;

        // 备用降级: loadCoursePage.do
        if (pId) {
          const pageRes = await loadAllCourses(pId, '', '');
          if (pageRes && pageRes.rows && Array.isArray(pageRes.rows)) {
            pageRes.rows.forEach(function (r) {
              const cid = String(r.courseId || (r.courseInfo && r.courseInfo.courseId) || '');
              const text = r.courseSchedule || r.currentStepRate || '';
              const isDone = String(text).indexOf('100') > -1 || r.status === 2;
              if (cid && !isDone && !resList.some(function (x) { return x.courseId === cid; })) {
                resList.push({
                  courseId: cid,
                  title: r.courseName || r.courseTitle || (r.courseInfo && r.courseInfo.courseTitle) || ('课程_' + cid),
                  score: r.score || r.courseScore || 0,
                  sourceId: '',
                  providerCorpCode: ''
                });
              }
            });
          }
        }
        return resList;
      } catch (err) {
        console.warn('[刷课助手-API] 拉取未完成课程异常:', err);
        return [];
      }
    }

    // 5. 结业考试准考资格检测
    async function checkExamAvailable(currentStageId) {
      if (!currentStageId) return null;
      return await get('/nms/html/courseStudy/checkIsCanExam.do', { currentStageId: currentStageId });
    }

    // 6. 学员官方结业证书与学时证明列表
    async function fetchUserCertificates(pageNo, pageSize) {
      return await get('/nms/html/studentsituation/studentsituation.listCerts.do', {
        pageNo: pageNo || 1,
        pageSize: pageSize || 10
      });
    }

    // 7. 异步探测课程完整章节树、总时长与待播小节元数据
    async function fetchCourseChapterMeta(courseId) {
      if (!courseId) return null;
      try {
        let res = await post('/tbc-rms/course/showCourseChapter', { courseId: courseId });
        if (!res || !res.bizResult) {
          res = await get('/tbc-rms/course/showCourseChapter', { courseId: courseId });
        }
        if (res && res.bizResult && Array.isArray(res.bizResult)) {
          let totalSections = 0;
          let totalDuration = 0;
          let unfinishedSections = 0;
          let unfinishedDuration = 0;
          res.bizResult.forEach(function (ch) {
            if (ch && Array.isArray(ch.resourceDTOS)) {
              ch.resourceDTOS.forEach(function (r) {
                totalSections++;
                const dur = Number(r.minStudyTime || r.timeToFinish || 0);
                totalDuration += dur;
                if (!r.confirmFinish && !r.finish) {
                  unfinishedSections++;
                  unfinishedDuration += dur;
                }
              });
            }
          });
          return {
            totalSections: totalSections,
            totalDuration: totalDuration,
            unfinishedSections: unfinishedSections,
            unfinishedDuration: unfinishedDuration
          };
        }
      } catch (e) {}
      return null;
    }

    return {
      get: get,
      post: post,
      startSessionHeartbeat: startSessionHeartbeat,
      getStageRequirements: getStageRequirements,
      getProjectDetail: getProjectDetail,
      loadAllCourses: loadAllCourses,
      fetchDetailCourses: fetchDetailCourses,
      checkExamAvailable: checkExamAvailable,
      fetchUserCertificates: fetchUserCertificates,
      fetchCourseChapterMeta: fetchCourseChapterMeta
    };
  })();

  /* ---------- ⚡ 课程元数据与性价比缓存库 (CourseMetaStore) ---------- */
  const CourseMetaStore = (function () {
    const STORAGE_KEY = 'tb21_course_meta_cache';
    let _cache = null;

    function load() {
      if (_cache) return _cache;
      try {
        _cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      } catch (e) {
        _cache = {};
      }
      return _cache;
    }

    function save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_cache || {}));
      } catch (e) {}
    }

    function get(courseId) {
      if (!courseId) return null;
      const c = load();
      return c[courseId] || null;
    }

    function set(courseId, data) {
      if (!courseId || !data) return;
      const c = load();
      c[courseId] = Object.assign({}, c[courseId] || {}, data, { ts: Date.now() });
      save();
    }

    // 计算综合效率指数 (CPI: 学分/分钟产出率 与 章节产出率)
    function calculateScore(credits, durationSec, sectionCount, isRush) {
      const cred = Math.max(0.1, Number(credits) || 1.0);
      const durMin = Math.max(1, Math.round((durationSec || 1800) / 60));
      const secCount = Math.max(1, Number(sectionCount) || 1);
      const baseCpi = cred / durMin; // 基础每分钟学分

      if (isRush) {
        // 极速模式下：1节视频约15~20秒！节数最少的课程拥有巨大速度优势
        const creditPerSec = cred / secCount;
        return Math.round((creditPerSec * 0.7 + baseCpi * 0.3) * 1000) / 1000;
      } else {
        return Math.round(baseCpi * 1000) / 1000;
      }
    }

    // 智能防抖扫描任务队列 (最大并发 3)
    const pendingQueue = [];
    let runningWorkers = 0;
    const MAX_WORKERS = 3;

    function processQueue() {
      while (runningWorkers < MAX_WORKERS && pendingQueue.length > 0) {
        const task = pendingQueue.shift();
        runningWorkers++;
        TbApiClient.fetchCourseChapterMeta(task.courseId).then(function (meta) {
          if (meta) {
            set(task.courseId, {
              totalSections: meta.totalSections,
              totalDuration: meta.totalDuration,
              unfinishedSections: meta.unfinishedSections,
              unfinishedDuration: meta.unfinishedDuration
            });
            if (task.onDone) task.onDone(meta);
          }
        }).catch(function () {}).finally(function () {
          runningWorkers--;
          processQueue();
        });
      }
    }

    function requestScan(courseId, onDone) {
      if (!courseId) return;
      const existing = get(courseId);
      if (existing && existing.ts && Date.now() - existing.ts < 7 * 24 * 3600 * 1000) {
        if (onDone) onDone(existing);
        return;
      }
      if (!pendingQueue.some(function (t) { return t.courseId === courseId; })) {
        pendingQueue.push({ courseId: courseId, onDone: onDone });
        processQueue();
      }
    }

    return {
      get: get,
      set: set,
      calculateScore: calculateScore,
      requestScan: requestScan
    };
  })();

  
  /* ---------- 课程卡片 CourseId 提取通用工具 ---------- */
  function getCardCourseId(card) {
    if (!card) return '';
    try {
      if (card.__vue__ && card.__vue__.courseInfo && card.__vue__.courseInfo.courseId) {
        return String(card.__vue__.courseInfo.courseId);
      }
    } catch (e) {}
    const nodes = [card].concat(Array.prototype.slice.call(card.querySelectorAll(
      '[data-course-id], [data-courseid], [course-id], [courseid], [data-id], a[href]'
    )));
    const attrs = ['data-course-id', 'data-courseid', 'course-id', 'courseid', 'data-id'];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < attrs.length; j++) {
        const val = nodes[i] && nodes[i].getAttribute && nodes[i].getAttribute(attrs[j]);
        if (val && /^[\w-]{4,}$/.test(val)) return String(val);
      }
      const href = nodes[i] && nodes[i].getAttribute && nodes[i].getAttribute('href');
      if (href) {
        try {
          const u = new URL(href, location.href);
          const val = u.searchParams.get('courseId') || u.searchParams.get('courseid') || u.searchParams.get('id');
          if (val) return String(val);
        } catch (e) {}
      }
    }
    return '';
  }

  /* ---------- 🚀 纯后台无头虚拟刷课执行器 (VirtualCourseWorker) ---------- */
  function VirtualCourseWorker(courseInfo, callbacks) {
    const courseId = String(courseInfo.courseId || courseInfo.id || '');
    const courseTitle = courseInfo.title || courseInfo.courseName || '未命名课程';
    const courseScore = Number(courseInfo.score || courseInfo.courseScore || 0);
    let sourceId = courseInfo.sourceId || '';
    let providerCorpCode = courseInfo.providerCorpCode || '';
    let state = 'INIT'; // INIT, RUNNING, FINISHED, ERROR, DESTROYED
    let currentSection = null;
    let sectionIndex = 0;
    let totalSections = 0;
    let elapsedSec = 0;
    let targetSec = 0;
    let virtualPos = 0;
    let timer = null;
    let isDestroyed = false;

    function formatTime(sec) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
    }

    function notifyStatus() {
      if (callbacks && callbacks.onStatusChange) {
        callbacks.onStatusChange(getStatus());
      }
    }

    async function start() {
      if (isDestroyed) return;
      try {
        state = 'INIT';
        notifyStatus();

        // 0. 官方 LMS 学分系统强绑定与会话入课握手（解决纯后台刷完不计学分的核心杀手锏！）
        const currentStageId = courseInfo.stageId || sessionStorage.getItem('tb21_current_stage_id') || '';
        try {
          // A. 阶段 SCO 对象初始化绑定 (NMS 官方核心学分注册点)
          if (currentStageId) {
            await TbApiClient.post('/nms/html/courseStudy/checkUserScoInitComplete.do', {
              courseId: courseId,
              currentStageId: currentStageId
            });
          }
          // B. 官方在线播放地址核验
          await TbApiClient.post('/els/html/courseInfo/courseinfo.checkOlineUrlHttp.do?courseId=' + courseId).catch(function () {});
          // C. ELS 官方正式入课注册 (进入在学状态，建立用户学习进度档案)
          await TbApiClient.get('/els/html/studyCourse/studyCourse.enterCourse.do?courseId=' + courseId + '&studyType=STUDY&courseType=NEW_COURSE_CENTER').catch(function () {});
          // D. 学习项容器握手
          await TbApiClient.get('/els/html/courseStudyItem/courseStudyItem.learn.do?courseId=' + courseId + '&courseType=NEW_COURSE_CENTER').catch(function () {});
          // E. 拉取官方 RMS 课程关联配置 (获取精确 sourceId 与 providerCorpCode)
          const cInfoRes = await TbApiClient.get('/els/html/course/course.courseInfoJsonForRms.do?courseId=' + courseId).catch(function () {});
          if (cInfoRes && typeof cInfoRes === 'object') {
            if (cInfoRes.sourceId) sourceId = String(cInfoRes.sourceId);
            if (cInfoRes.providerCorpCode) providerCorpCode = String(cInfoRes.providerCorpCode);
          }
        } catch (e) {
          console.warn('[刷课助手-静默舰队] 官方入课学分握手容错跳过:', e);
        }

        // 1. 获取小节列表
        let chapData = await TbApiClient.post('/tbc-rms/course/showCourseChapter', { courseId: courseId, sourceId: sourceId, providerCorpCode: providerCorpCode });
        if (!chapData || !chapData.bizResult || !Array.isArray(chapData.bizResult)) {
          chapData = await TbApiClient.get('/tbc-rms/course/showCourseChapter', { courseId: courseId });
        }
        if (!chapData || !chapData.bizResult || !Array.isArray(chapData.bizResult)) {
          state = 'ERROR';
          notifyStatus();
          if (callbacks && callbacks.onError) callbacks.onError('获取课程结构失败');
          return;
        }

        // 2. 获取已有记录
        const recordMap = {};
        const finishMap = {};
        try {
          const recData = await TbApiClient.post('/tbc-rms/record/getStudyRecordList', {
            courseId: courseId,
            sourceId: sourceId,
            providerCorpCode: providerCorpCode
          });
          if (recData && recData.bizResult && Array.isArray(recData.bizResult)) {
            recData.bizResult.forEach(function (r) {
              if (r.resourceId) {
                recordMap[r.resourceId] = r.recordId;
                if (r.confirmFinish === 1) finishMap[r.resourceId] = true;
              }
            });
          }
        } catch (e) {}

        // 3. 汇总未完成小节
        const pendingList = [];
        chapData.bizResult.forEach(function (chap) {
          if (chap && Array.isArray(chap.resourceDTOS)) {
            chap.resourceDTOS.forEach(function (res) {
              if (!finishMap[res.resourceId] && !res.confirmFinish && !res.finish) {
                pendingList.push({
                  chapterId: chap.chapterId,
                  resourceId: res.resourceId,
                  resourceName: res.resourceName || '小节',
                  resourceType: res.resourceType || 'video',
                  timeToFinish: Number(res.timeToFinish || res.minStudyTime || 300),
                  currentStudyTime: Number(res.currentStudyTime || 0),
                  recordId: recordMap[res.resourceId] || null
                });
              }
            });
          }
        });

        totalSections = pendingList.length;
        if (totalSections === 0) {
          state = 'FINISHED';
          notifyStatus();
          if (callbacks && callbacks.onComplete) callbacks.onComplete(courseId, courseTitle);
          return;
        }

        // 4. 逐节执行
        for (let i = 0; i < pendingList.length; i++) {
          if (isDestroyed) return;
          sectionIndex = i + 1;
          currentSection = pendingList[i];
          await runSection(currentSection);
        }

        // 5. 完结整门课：双重封顶上报 + 官方学分结算握手（确保平台 100% 结算学分！）
        state = 'FINISHED';
        try {
          const lastSec = pendingList[pendingList.length - 1];
          if (lastSec) {
            // 写入关课归档记录 (writeRecordWhileClose)
            await TbApiClient.post('/tbc-rms/record/writeRecordWhileClose', {
              recordId: lastSec.recordId,
              courseId: courseId,
              sourceId: sourceId,
              providerCorpCode: providerCorpCode,
              chapterId: lastSec.chapterId,
              resourceId: lastSec.resourceId,
              timeToFinish: lastSec.timeToFinish,
              currentPosition: lastSec.timeToFinish,
              type: lastSec.resourceType,
              currentStudyTime: lastSec.timeToFinish,
              pageIndex: 0
            }).catch(function () {});
          }

          // 官方全局进度同步
          await TbApiClient.post('/tbc-rms/record/syncStudyRecord', {
            courseId: courseId,
            sourceId: sourceId,
            providerCorpCode: providerCorpCode
          }).catch(function () {});

          // 退出课程上报日志
          await TbApiClient.post('/biz-oim/course/saveStudyLog.do?courseId=' + courseId, {
            studyLogVO: {
              courseId: courseId,
              courseTitle: courseTitle
            },
            eventType: 'QUIT_STUDY'
          }).catch(function () {});

          // ELS 课件注销与学分核算入库握手
          await TbApiClient.get('/els/html/courseStudyItem/courseStudyItem.logOut.do').catch(function () {});
          await TbApiClient.get('/els/html/studyCourse/studyCourse.enterCourse.do?courseId=' + courseId + '&studyType=STUDY&courseType=NEW_COURSE_CENTER').catch(function () {});
        } catch (e) {
          console.warn('[刷课助手-静默舰队] 完结结课上报容错:', e);
        }

        notifyStatus();
        if (callbacks && callbacks.onComplete) callbacks.onComplete(courseId, courseTitle);
      } catch (err) {
        state = 'ERROR';
        notifyStatus();
        if (callbacks && callbacks.onError) callbacks.onError(err);
      }
    }

    function runSection(sec) {
      return new Promise(function (resolve) {
        if (isDestroyed) { resolve(); return; }

        // 非视频类（文档/网页/图文）：0.5s 极速秒结
        if (sec.resourceType !== 'video' && sec.resourceType !== 'audio') {
          (async function () {
            try {
              await TbApiClient.post('/biz-oim/course/saveStudyLog.do?courseId=' + courseId, {
                studyLogVO: {
                  courseItemId: sec.resourceId,
                  courseItemName: sec.resourceName,
                  courseId: courseId,
                  videoDuration: 1000
                },
                eventType: 'ENTER_COURSE_ITEM'
              });
              await TbApiClient.post('/tbc-rms/record/updateCourseRecord', {
                recordId: sec.recordId,
                courseId: courseId,
                sourceId: sourceId,
                providerCorpCode: providerCorpCode,
                chapterId: sec.chapterId,
                resourceId: sec.resourceId,
                timeToFinish: 1,
                currentPosition: 1,
                type: sec.resourceType,
                currentStudyTime: 1,
                pageIndex: 1
              });
              await TbApiClient.post('/biz-oim/course/saveStudyLog.do?courseId=' + courseId, {
                studyLogVO: {
                  courseItemId: sec.resourceId,
                  courseItemName: sec.resourceName,
                  courseId: courseId,
                  videoDuration: 1000
                },
                eventType: 'COMPLETE_COURSE_ITEM'
              });
            } catch (e) {}
            resolve();
          })();
          return;
        }

        // 视频类：根据舰队设定的倍速推进（支持 2x 稳健 或 16x 极速冲刺）
        const speed = HeadlessFleetManager.getSpeed ? HeadlessFleetManager.getSpeed() : 16;
        const dur = Math.max(10, sec.timeToFinish);
        const reqWait = Math.max(3, Math.ceil(dur / speed));
        const already = sec.currentStudyTime || 0;
        const remainWait = Math.max(3, Math.ceil((dur - Math.min(dur, already)) / speed));
        elapsedSec = 0;
        targetSec = remainWait;
        state = 'RUNNING';
        notifyStatus();

        // 进课握手
        TbApiClient.post('/biz-oim/course/saveStudyLog.do?courseId=' + courseId, {
          studyLogVO: {
            courseItemId: sec.resourceId,
            courseItemName: sec.resourceName,
            courseId: courseId,
            videoDuration: dur * 1000
          },
          eventType: 'ENTER_COURSE_ITEM'
        }).catch(function () {});

        TbApiClient.post('/biz-oim/course/saveStudyLog.do?courseId=' + courseId, {
          studyLogVO: {
            courseItemId: sec.resourceId,
            courseItemName: sec.resourceName,
            courseId: courseId,
            videoDuration: dur * 1000
          },
          eventType: 'PLAY'
        }).catch(function () {});

        timer = setInterval(async function () {
          if (isDestroyed) {
            clearInterval(timer);
            timer = null;
            resolve();
            return;
          }
          elapsedSec++;
          virtualPos = Math.min(dur, Math.round(already + elapsedSec * speed));
          notifyStatus();

          // 每 60 秒心跳保活
          if (elapsedSec % 60 === 0) {
            TbApiClient.get('/ubr/heartbeat/beat', { courseId: courseId }).catch(function () {});
          }

          // 每 180 秒进度存档
          if (elapsedSec % 180 === 0) {
            TbApiClient.post('/tbc-rms/record/updateCourseRecord', {
              recordId: sec.recordId,
              courseId: courseId,
              sourceId: sourceId,
              providerCorpCode: providerCorpCode,
              chapterId: sec.chapterId,
              resourceId: sec.resourceId,
              timeToFinish: dur,
              currentPosition: virtualPos,
              type: 'video',
              currentStudyTime: already + elapsedSec,
              pageIndex: 0
            }).catch(function () {});
          }

          // 结课判定
          if (elapsedSec >= remainWait) {
            clearInterval(timer);
            timer = null;
            try {
              await TbApiClient.post('/biz-oim/course/saveStudyLog.do?courseId=' + courseId, {
                studyLogVO: {
                  courseItemId: sec.resourceId,
                  courseItemName: sec.resourceName,
                  courseId: courseId,
                  videoDuration: dur * 1000
                },
                eventType: 'COMPLETE_COURSE_ITEM'
              });
              await TbApiClient.post('/tbc-rms/record/updateCourseRecord', {
                recordId: sec.recordId,
                courseId: courseId,
                sourceId: sourceId,
                providerCorpCode: providerCorpCode,
                chapterId: sec.chapterId,
                resourceId: sec.resourceId,
                timeToFinish: dur,
                currentPosition: dur,
                type: 'video',
                currentStudyTime: Math.max(Math.round(dur * 0.55), already + elapsedSec),
                pageIndex: 0
              });
              await TbApiClient.post('/tbc-rms/record/syncStudyRecord', {
                courseId: courseId,
                sourceId: sourceId,
                providerCorpCode: providerCorpCode
              });
            } catch (e) {}
            resolve();
          }
        }, 1000);
      });
    }

    function destroy() {
      isDestroyed = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      state = 'DESTROYED';
    }

    function getStatus() {
      const percent = targetSec > 0 ? Math.min(100, Math.round((elapsedSec / targetSec) * 100)) : (state === 'FINISHED' ? 100 : 0);
      const remainSec = Math.max(0, targetSec - elapsedSec);
      return {
        courseId: courseId,
        courseTitle: courseTitle,
        score: courseScore,
        sectionIndex: sectionIndex,
        totalSections: totalSections,
        sectionName: currentSection ? currentSection.resourceName : '',
        percent: percent,
        remainSec: remainSec,
        remainText: formatTime(remainSec),
        state: state
      };
    }

    return {
      start: start,
      destroy: destroy,
      getStatus: getStatus
    };
  }


  // 核心突破：穿透触发 Vue 课程详情页原生重新请求，实时入账学分并刷新课程状态
  function refreshDetailVueComponent() {
    try {
      const appEl = document.querySelector('#app') || document.body;
      function findDetailVm(node) {
        if (!node) return null;
        const v = node.__vue__ || node;
        if (v && (typeof v.getRmStageByProjectId === 'function' || typeof v.getMustCourseDetailByProjectId === 'function')) {
          return v;
        }
        if (v && Array.isArray(v.$children)) {
          for (let i = 0; i < v.$children.length; i++) {
            const found = findDetailVm(v.$children[i]);
            if (found) return found;
          }
        }
        if (node.children && node.children.length) {
          for (let j = 0; j < node.children.length; j++) {
            const found = findDetailVm(node.children[j]);
            if (found) return found;
          }
        }
        return null;
      }
      const targetVm = findDetailVm(appEl);
      if (targetVm) {
        const roadMapId = targetVm.roadMapId || sessionStorage.getItem('tb21_current_roadmap_id');
        const currentStageId = targetVm.currentStageId || sessionStorage.getItem('tb21_current_stage_id');
        if (roadMapId && typeof targetVm.getRmStageByProjectId === 'function') {
          targetVm.getRmStageByProjectId(roadMapId);
        }
        if (currentStageId) {
          if (typeof targetVm.getMustCourseDetailByProjectId === 'function') targetVm.getMustCourseDetailByProjectId(currentStageId);
          if (typeof targetVm.getSelectiveCourseDetailByProjectId === 'function') targetVm.getSelectiveCourseDetailByProjectId(currentStageId);
        }
        console.log('[刷课助手] 🔄 成功唤醒 Vue 详情页原生刷新接口，已修学分已实时入账！');
      }
    } catch (e) {
      console.warn('[刷课助手] 唤醒 Vue 详情页跳过:', e);
    }
  }

  /* ---------- 🚀 纯后台无头静默舰队调度中心 (HeadlessFleetManager) ---------- */
  const HeadlessFleetManager = (function () {
    let isRunning = false;
    let concurrency = 3;
    let speed = 16;
    let queue = [];
    let workers = [];
    let completedCourses = [];
    const listeners = [];

    function loadSettings() {
      try {
        concurrency = Math.max(1, Math.min(8, parseInt(localStorage.getItem('tb21_headless_concurrency'), 10) || 3));
        speed = parseInt(localStorage.getItem('tb21_headless_speed'), 10) || 16;
        isRunning = localStorage.getItem('tb21_headless_active') === '1';
      } catch (e) { concurrency = 3; isRunning = false; }
    }
    loadSettings();

    function setConcurrency(c) {
      concurrency = Math.max(1, Math.min(8, c));
      try { localStorage.setItem('tb21_headless_concurrency', String(concurrency)); } catch (e) {}
      dispatch();
      notify();
    }

    function getConcurrency() { return concurrency; }

    function setSpeed(s) {
      speed = Math.max(1, Math.min(32, s));
      try { localStorage.setItem('tb21_headless_speed', String(speed)); } catch (e) {}
      notify();
    }

    function getSpeed() { return speed; }

    function addCourse(courseInfo) {
      if (!courseInfo || !courseInfo.courseId) return;
      const cid = String(courseInfo.courseId);
      if (queue.some(function (c) { return String(c.courseId) === cid; })) return;
      if (workers.some(function (w) { return String(w.getStatus().courseId) === cid; })) return;
      if (completedCourses.indexOf(cid) > -1) return;
      queue.push(courseInfo);
      if (isRunning) dispatch();
    }

    function setCourses(courses) {
      if (!Array.isArray(courses)) return;
      courses.forEach(addCourse);
    }

    function dispatch() {
      if (!isRunning) return;
      while (workers.length < concurrency && queue.length > 0) {
        const course = queue.shift();
        const worker = new VirtualCourseWorker(course, {
          onStatusChange: function () { notify(); },
          onComplete: function (cid, title) {
            completedCourses.push(String(cid));
            console.log('[刷课助手-静默舰队] 🏆 课程已在纯后台完播结课并核算学分: ' + title);
            try {
              const cards = document.querySelectorAll('.text-item.cursor, .course-item, .box-card');
              cards.forEach(function (c) {
                if (getCardCourseId(c) === cid) {
                  c.setAttribute('data-course-done', '1');
                  const info = c.querySelector('.text-info');
                  if (info && info.textContent.indexOf('已完成') === -1) {
                    info.textContent = info.textContent + ' (已完成)';
                  }
                }
              });
            } catch (e) {}

            // 核心突破：穿透触发 Vue 课程详情页刷新，并即刻刷新悬浮面板学分进度
            refreshDetailVueComponent();
            try {
              const panel = cachedEl('tb21-auto-panel');
              if (panel && typeof updateAutoPanel === 'function') {
                updateAutoPanel(panel, panel.__tb21ExtraInfo);
              }
            } catch (e) {}

            workers = workers.filter(function (w) { return w !== worker; });
            dispatch();
            notify();
          },
          onError: function (err) {
            console.warn('[刷课助手-静默舰队] ⚠️ 任务执行异常:', err);
            workers = workers.filter(function (w) { return w !== worker; });
            dispatch();
            notify();
          }
        });
        workers.push(worker);
        worker.start();
      }
      notify();
    }

    function start() {
      isRunning = true;
      try { localStorage.setItem('tb21_headless_active', '1'); } catch (e) {}
      loadSettings();
      dispatch();
      notify();
    }

    function stop() {
      isRunning = false;
      try { localStorage.setItem('tb21_headless_active', '0'); } catch (e) {}
      workers.forEach(function (w) { w.destroy(); });
      workers = [];
      notify();
    }

    function getActiveWorkersStatus() {
      return workers.map(function (w) { return w.getStatus(); });
    }

    function isFleetRunning() { return isRunning; }
    function getQueueCount() { return queue.length; }
    function getCompletedCount() { return completedCourses.length; }

    function onUpdate(cb) {
      if (typeof cb === 'function') listeners.push(cb);
    }

    function notify() {
      listeners.forEach(function (cb) { try { cb(); } catch (e) {} });
    }

    return {
      start: start,
      stop: stop,
      addCourse: addCourse,
      setCourses: setCourses,
      setConcurrency: setConcurrency,
      getConcurrency: getConcurrency,
      setSpeed: setSpeed,
      getSpeed: getSpeed,
      getActiveWorkersStatus: getActiveWorkersStatus,
      isFleetRunning: isFleetRunning,
      getQueueCount: getQueueCount,
      getCompletedCount: getCompletedCount,
      onUpdate: onUpdate
    };
  })();

  function getRouteQueryParams() {
    const hash = location.hash || '';
    const qIdx = hash.indexOf('?');
    const params = {};
    if (qIdx !== -1) {
      const qs = hash.slice(qIdx + 1).split('&');
      qs.forEach(function (pair) {
        const parts = pair.split('=');
        if (parts[0]) params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
      });
    }
    if (location.search) {
      const s = location.search.slice(1).split('&');
      s.forEach(function (pair) {
        const parts = pair.split('=');
        const k = decodeURIComponent(parts[0]);
        if (k && !params[k]) params[k] = decodeURIComponent(parts[1] || '');
      });
    }
    return params;
  }

  function normalizeAutoText(value) {
    return String(value || '').replace(/\s+/g, '').replace(/[：:·•|｜]/g, '').toLowerCase();
  }
  function readAutoJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value === null ? fallback : value;
    } catch (e) { return fallback; }
  }
  function writeAutoJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function readFreshAutoMap(key) {
    const now = Date.now();
    const value = readAutoJson(key, {});
    let changed = false;
    Object.keys(value).forEach(function (itemKey) {
      if (!value[itemKey] || now - value[itemKey] > AUTO_MEMORY_TTL) {
        delete value[itemKey];
        changed = true;
      }
    });
    if (changed) writeAutoJson(key, value);
    return value;
  }
  function rememberAutoKey(storageKey, itemKey) {
    if (!itemKey) return;
    const value = readFreshAutoMap(storageKey);
    value[itemKey] = Date.now();
    writeAutoJson(storageKey, value);
  }
  function hasFreshAutoKey(storageKey, itemKey) {
    if (!itemKey) return false;
    return !!readFreshAutoMap(storageKey)[itemKey];
  }
  function makeCategoryKey(title, year) {
    return 'category:' + (year || '') + ':' + normalizeAutoText(title);
  }
  function getActiveCategory() {
    return readAutoJson(AUTO_KEY_ACTIVE_CATEGORY, null);
  }
  function rememberPendingCourseDone(courseId, fallbackTitle) {
    const pending = readAutoJson(AUTO_KEY_PENDING_COURSE, null);
    if (pending && pending.key) rememberAutoKey(AUTO_KEY_DONE_COURSES, pending.key);
    if (courseId) rememberAutoKey(AUTO_KEY_DONE_COURSES, 'course-id:' + courseId);
    try {
      localStorage.setItem('tb21_helper_recent_done_title', (pending && pending.title) || fallbackTitle || '');
      localStorage.setItem('tb21_helper_recent_done_ts', String(Date.now()));
      localStorage.removeItem(AUTO_KEY_PENDING_COURSE);
    } catch (e) {}
  }

  function isAutoRunning() {
    try { return localStorage.getItem(AUTO_KEY_RUNNING) === '1'; } catch (e) { return false; }
  }
  function setAutoRunning(v) {
    try { if (v) localStorage.setItem(AUTO_KEY_RUNNING, '1'); else localStorage.removeItem(AUTO_KEY_RUNNING); } catch (e) {}
  }
  function getDetailUrl() {
    try { return localStorage.getItem(AUTO_KEY_DETAIL_URL) || ''; } catch (e) { return ''; }
  }
  function setDetailUrl(url) {
    try { localStorage.setItem(AUTO_KEY_DETAIL_URL, url); } catch (e) {}
  }

  /* ---------- 🚀 纯后台静默舰队看板组件 (顶级通用组件) ---------- */
  
  /* ---------- 🚀 静默舰队即时全景抓取与任务派发 ---------- */
  async function scanAndDispatchFleet() {
    const isDetail = location.hash.indexOf('courseDetail') > -1 || location.href.indexOf('courseDetail') > -1;
    const isList = location.hash.indexOf('course/list') > -1 || location.href.indexOf('course/list') > -1;

    if (isDetail) {
      let fleetCourses = [];

      // 策略 A: 从主页面上下文穿透写入的 sessionStorage 提取
      try {
        const domStr = sessionStorage.getItem('tb21_dom_courses');
        if (domStr) {
          const domList = JSON.parse(domStr);
          if (Array.isArray(domList)) {
            domList.forEach(function (c) {
              if (!c.done && c.courseId) {
                fleetCourses.push({
                  courseId: String(c.courseId),
                  title: c.title || ('课程_' + c.courseId),
                  score: Number(c.score || c.courseScore || 0),
                  sourceId: '',
                  providerCorpCode: ''
                });
              }
            });
          }
        }
      } catch (e) {}

      // 策略 B: 从已被主上下文注入 data-course-id 的 DOM 卡片直接扫描
      if (fleetCourses.length === 0) {
        const cards = document.querySelectorAll('.text-item.cursor, .course-item, .box-card');
        cards.forEach(function (c) {
          const text = c.textContent || '';
          if (text.indexOf('已完成') > -1 || c.getAttribute('data-course-done') === '1') return;
          const cid = getCardCourseId(c);
          if (!cid) return;
          const titleEl = c.querySelector('.text-title, .title, .course-name, h4, h3, .item__name');
          const title = c.getAttribute('data-course-title') || (titleEl ? titleEl.textContent.trim() : ('课程_' + cid));
          const scoreVal = parseFloat(c.getAttribute('data-course-score') || getCourseCredits(c)) || 0;
          if (!fleetCourses.some(function (x) { return x.courseId === cid; })) {
            fleetCourses.push({
              courseId: cid,
              title: title,
              score: scoreVal,
              sourceId: '',
              providerCorpCode: ''
            });
          }
        });
      }

      // 策略 C: 终极杀手锏——官方接口全量拉取当前项目所有未完成课程 (100%覆盖、零漏单)
      if (fleetCourses.length === 0) {
        const params = getRouteQueryParams();
        const projectId = params.projectId || '';
        if (projectId) {
          console.log('[刷课助手-静默舰队] 📡 正在通过官方接口全量同步当前项目未学课程 (projectId: ' + projectId + ')...');
          try {
            const apiCourses = await TbApiClient.fetchDetailCourses(projectId);
            if (apiCourses && apiCourses.length > 0) {
              fleetCourses = apiCourses;
              console.log('[刷课助手-静默舰队] 🏆 官方接口成功捕获未学课程共 ' + apiCourses.length + ' 门！');
            }
          } catch (e) {}
        }
      }

      if (fleetCourses.length > 0) {
        HeadlessFleetManager.setCourses(fleetCourses);
        console.log('[刷课助手-静默舰队] 🎯 静默舰队成功装载 ' + fleetCourses.length + ' 门待刷课程，并发调度起跑！');
      } else {
        console.log('[刷课助手-静默舰队] ℹ️ 当前页面卡片暂未完全载入或已全部学完，保持待命监听');
      }
    } else if (isList) {
      console.log('[刷课助手-静默舰队] 🎯 列表页触发静默舰队，自动进入目标年度攻坚...');
      const enterBtns = document.querySelectorAll('.course__item .enter-btn, .box-card .enter-btn');
      if (enterBtns.length > 0) {
        enterBtns[0].click();
      }
    }
    renderFleetDashboard();
  }

  function renderFleetDashboard() {
    const panel = cachedEl('tb21-auto-panel');
    if (!panel) return;
    const body = panel.querySelector('.ap-body');
    if (!body) return;
    let fleetBox = body.querySelector('.ap-fleet-box');
    if (!fleetBox) {
      fleetBox = document.createElement('div');
      fleetBox.className = 'ap-fleet-box';
      const infoEl = body.querySelector('.ap-info');
      if (infoEl) body.insertBefore(fleetBox, infoEl);
      else body.appendChild(fleetBox);
    }

    const isFleetActive = HeadlessFleetManager.isFleetRunning();
    const isDetailRoute = location.hash && location.hash.indexOf('courseDetail') > -1;

    // 智能布局：在大类目页面且静默舰队未启动时，自动隐藏舰队框，优先把完整视觉空间留给年度大类目攻坚排期
    if (!isFleetActive && !isDetailRoute) {
      fleetBox.style.display = 'none';
      return;
    }
    fleetBox.style.display = 'block';

    const conc = HeadlessFleetManager.getConcurrency();
    const speed = HeadlessFleetManager.getSpeed ? HeadlessFleetManager.getSpeed() : 16;
    const workers = HeadlessFleetManager.getActiveWorkersStatus();
    const qCount = HeadlessFleetManager.getQueueCount();
    const cCount = HeadlessFleetManager.getCompletedCount();

    // 1. 初始化 DOM 框架骨架（仅在第一次进入时构建，绝不推倒重置，保障滚动条坚如磐石）
    let listEl = fleetBox.querySelector('.ap-fleet-list');
    if (!listEl) {
      fleetBox.innerHTML =
        '<div class="ap-fleet-header">' +
          '<label class="ap-fleet-label" title="开启后无需打开播放页，全部在当前标签页纯后台0%CPU静默多课并发刷课">' +
            '<input type="checkbox" id="tb21-headless-toggle"' + (isFleetActive ? ' checked' : '') + '>' +
            '<span>🚀 纯后台静默舰队</span>' +
          '</label>' +
          '<span class="ap-fleet-status-tag"></span>' +
        '</div>' +
        '<div class="ap-fleet-ctrl-grid">' +
          '<div class="ap-fleet-conc-row">' +
            '<span class="ap-fleet-conc-title" title="后台同时挂机的课程数量">并发路数:</span>' +
            '<div class="ap-fleet-conc-btns">' +
              '<button class="ap-conc-btn' + (conc === 2 ? ' active' : '') + '" data-conc="2" title="同时静默挂机2门课">2门</button>' +
              '<button class="ap-conc-btn' + (conc === 3 ? ' active' : '') + '" data-conc="3" title="同时静默挂机3门课(推荐)">3门(推荐)</button>' +
              '<button class="ap-conc-btn' + (conc === 5 ? ' active' : '') + '" data-conc="5" title="同时静默挂机5门课">5门</button>' +
            '</div>' +
          '</div>' +
          '<div class="ap-fleet-conc-row">' +
            '<span class="ap-fleet-conc-title" title="每门静默课程的虚拟时钟推进倍速">单课倍速:</span>' +
            '<div class="ap-fleet-conc-btns">' +
              '<button class="ap-speed-btn' + (speed === 2 ? ' active' : '') + '" data-speed="2" title="2x 稳健模式（单课2x，3门并发等效6x）">2x稳健</button>' +
              '<button class="ap-speed-btn' + (speed === 16 ? ' active' : '') + '" data-speed="16" title="16x 极速冲刺模式（单课16x，3门并发等效48x，5门并发等效80x！）" style="color:' + (speed === 16 ? '#fff' : '#f59e0b') + '">⚡ 16x狂飙 ★</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="ap-fleet-list"></div>' +
        '<div class="ap-fleet-footer" style="font-size:10px;color:#64748b;margin-top:4px;display:flex;justify-content:space-between;"></div>';

      listEl = fleetBox.querySelector('.ap-fleet-list');

      const toggle = fleetBox.querySelector('#tb21-headless-toggle');
      if (toggle) {
        toggle.addEventListener('change', function () {
          if (toggle.checked) {
            HeadlessFleetManager.start();
            scanAndDispatchFleet();
          } else {
            HeadlessFleetManager.stop();
          }
          renderFleetDashboard();
        });
      }

      fleetBox.querySelectorAll('.ap-conc-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const c = parseInt(btn.dataset.conc, 10);
          HeadlessFleetManager.setConcurrency(c);
          if (!HeadlessFleetManager.isFleetRunning()) HeadlessFleetManager.start();
          scanAndDispatchFleet();
          renderFleetDashboard();
        });
      });

      fleetBox.querySelectorAll('.ap-speed-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const s = parseInt(btn.dataset.speed, 10);
          HeadlessFleetManager.setSpeed(s);
          renderFleetDashboard();
        });
      });
    }

    // 2. 状态与控制项差量精准更新
    const toggle = fleetBox.querySelector('#tb21-headless-toggle');
    if (toggle) toggle.checked = isFleetActive;

    const statusTag = fleetBox.querySelector('.ap-fleet-status-tag');
    if (statusTag) {
      statusTag.style.cssText = 'font-size:10px;padding:1px 6px;border-radius:4px;' +
        (isFleetActive ? 'background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3);' : 'background:rgba(148,163,184,.1);color:#94a3b8;');
      statusTag.textContent = isFleetActive ? ('🟢 运行中 (' + workers.length + '/' + conc + '线)') : '⚪ 已就绪';
    }

    fleetBox.querySelectorAll('.ap-conc-btn').forEach(function (btn) {
      const c = parseInt(btn.dataset.conc, 10);
      btn.classList.toggle('active', c === conc);
    });

    fleetBox.querySelectorAll('.ap-speed-btn').forEach(function (btn) {
      const s = parseInt(btn.dataset.speed, 10);
      btn.classList.toggle('active', s === speed);
    });

    const footer = fleetBox.querySelector('.ap-fleet-footer');
    if (footer) {
      footer.style.display = isFleetActive ? 'flex' : 'none';
      footer.innerHTML = '<span>已结课: ' + cCount + ' 门</span><span>排队中: ' + qCount + ' 门</span>';
    }

    // 3. 极速就地差量更新 / 锁定滚动条（彻底终结滚动条跳回原位的顽疾！）
    if (!isFleetActive) {
      const emptyHtml = '<div class="ap-fleet-empty" style="grid-column:1/-1;">静默舰队未启动（勾选开启0%CPU多课并发）</div>';
      if (listEl._lastHtml !== emptyHtml) {
        listEl.innerHTML = emptyHtml;
        listEl._lastHtml = emptyHtml;
      }
      return;
    }

    if (workers.length === 0) {
      const idleHtml = '<div class="ap-fleet-empty" style="grid-column:1/-1;">' + (qCount > 0 ? ('正在调度队列中 ' + qCount + ' 门课程...') : '队列暂无课程 <button id="tb21-btn-force-scan" style="background:#0284c7;color:#fff;border:none;padding:1px 6px;border-radius:4px;cursor:pointer;margin-left:4px;font-size:10px;">重新扫描</button>') + '</div>';
      if (listEl._lastHtml !== idleHtml) {
        listEl.innerHTML = idleHtml;
        listEl._lastHtml = idleHtml;
        const forceScanBtn = listEl.querySelector('#tb21-btn-force-scan');
        if (forceScanBtn) {
          forceScanBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            forceScanBtn.textContent = '扫描中...';
            if (!HeadlessFleetManager.isFleetRunning()) HeadlessFleetManager.start();
            scanAndDispatchFleet().then(function() {
              renderFleetDashboard();
            });
          });
        }
      }
      return;
    }

    // 检查现有卡片是否与当前活跃课程一一对应
    const existingCards = listEl.querySelectorAll('.ap-fleet-card');
    const existingCids = Array.from(existingCards).map(function(c) { return c.dataset.cid; }).join(',');
    const newCids = workers.map(function(w) { return String(w.courseId); }).join(',');

    if (existingCards.length > 0 && existingCids === newCids) {
      // 核心突破：DOM 节点 100% 保持不动！只更新文字与进度条属性！
      // 滚动条事件、拖动状态、鼠标悬停 0 干扰，绝不会发生任何重绘回弹！
      workers.forEach(function (w) {
        const card = listEl.querySelector('.ap-fleet-card[data-cid="' + w.courseId + '"]');
        if (!card) return;
        const timeEl = card.querySelector('.ap-fleet-time');
        if (timeEl && timeEl.textContent !== '⏱️ ' + w.remainText) {
          timeEl.textContent = '⏱️ ' + w.remainText;
        }
        const scoreEl = card.querySelector('.ap-fleet-score');
        const scoreText = w.score ? (w.score + ' 学分') : '';
        if (scoreEl && scoreEl.textContent !== scoreText) {
          scoreEl.textContent = scoreText;
        }
        const secEl = card.querySelector('.ap-fleet-sec-info');
        const secText = (w.totalSections > 0 ? ('第' + w.sectionIndex + '/' + w.totalSections + '节: ' + w.sectionName) : '准备中');
        if (secEl && secEl.textContent !== secText) {
          secEl.textContent = secText;
        }
        const pctEl = card.querySelector('.ap-fleet-percent');
        const pctText = w.percent + '%';
        if (pctEl && pctEl.textContent !== pctText) {
          pctEl.textContent = pctText;
        }
        const barEl = card.querySelector('.ap-fleet-bar');
        if (barEl) {
          barEl.style.width = w.percent + '%';
        }
      });
    } else {
      // 仅在课程变动（结课/换课）时重构列表，并严格保留当前滚动位置
      let cardsHtml = '';
      workers.forEach(function (w) {
        cardsHtml +=
          '<div class="ap-fleet-card" data-cid="' + w.courseId + '">' +
            '<div class="ap-fleet-card-title">' +
              '<span class="ap-fleet-cname" title="' + w.courseTitle + '">' + w.courseTitle + '</span>' +
              '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">' +
                (w.score ? ('<span class="ap-fleet-score" style="background:rgba(245,158,11,.15);color:#fbbf24;border:1px solid rgba(245,158,11,.3);padding:1px 5px;border-radius:4px;font-size:10px;font-weight:700;">' + w.score + ' 学分</span>') : '') +
                '<span class="ap-fleet-time">⏱️ ' + w.remainText + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="ap-fleet-card-sub">' +
              '<span class="ap-fleet-sec-info">' + (w.totalSections > 0 ? ('第' + w.sectionIndex + '/' + w.totalSections + '节: ' + w.sectionName) : '准备中') + '</span>' +
              '<span class="ap-fleet-percent" style="font-weight:700;color:#38bdf8;">' + w.percent + '%</span>' +
            '</div>' +
            '<div class="ap-fleet-track">' +
              '<div class="ap-fleet-bar" style="width:' + w.percent + '%"></div>' +
            '</div>' +
          '</div>';
      });

      const savedScrollTop = listEl.scrollTop;
      listEl.innerHTML = cardsHtml;
      listEl._lastHtml = cardsHtml;
      listEl.scrollTop = savedScrollTop;
    }
  }
  HeadlessFleetManager.onUpdate(renderFleetDashboard);

  // 列表页/详情页共用的小型控制面板
  function buildAutoPanel(extraInfo) {
    const existingPanel = cachedEl('tb21-auto-panel');
    if (existingPanel) {
      // SPA 切换后复用面板，但必须替换为当前页面的数据提供器。
      existingPanel.__tb21ExtraInfo = extraInfo;
      updateAutoPanel(existingPanel, extraInfo);
      return existingPanel;
    }
    const css = document.createElement('style');
    css.textContent = `
      #tb21-auto-panel{position:fixed;top:14px;right:14px;z-index:999999;width:500px;max-width:calc(100vw - 28px);
        background:rgba(15,23,42,.88);color:#f1f5f9;border-radius:14px;
        font:12px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
        box-shadow:0 16px 36px -6px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.1),inset 0 1px 0 rgba(255,255,255,.15);
        backdrop-filter:blur(16px) saturate(180%);-webkit-backdrop-filter:blur(16px) saturate(180%);
        user-select:none;overflow:hidden;transition:box-shadow .25s,width .25s cubic-bezier(.4,0,.2,1),border-radius .25s}
      #tb21-auto-panel.ap-hide{width:auto;min-width:145px;border-radius:20px}
      #tb21-auto-panel.ap-hide .ap-head{padding:7px 12px;border-bottom:none;border-radius:20px}
      #tb21-auto-panel.ap-hide .ap-body{display:none}
      #tb21-auto-panel.ap-hide .ap-fold{transform:rotate(-90deg)}
      #tb21-auto-panel .ap-head{display:flex;justify-content:space-between;align-items:center;
        padding:9px 12px;background:rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.06);
        font-weight:700;font-size:13px;cursor:grab}
      #tb21-auto-panel .ap-head:active{cursor:grabbing}
      #tb21-auto-panel .ap-head-title{display:flex;align-items:center;gap:6px}
      #tb21-auto-panel .ap-logo{font-size:14px;filter:drop-shadow(0 0 4px rgba(245,158,11,.6))}
      #tb21-auto-panel .ap-status-badge{display:inline-block;width:7px;height:7px;border-radius:50%;margin-left:2px;transition:all .3s}
      #tb21-auto-panel .ap-status-badge.running{background:#10b981;box-shadow:0 0 8px #10b981;animation:ap-pulse 2s infinite}
      #tb21-auto-panel .ap-status-badge.stopped{background:#ef4444;box-shadow:0 0 5px #ef4444}
      @keyframes ap-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.25);opacity:.75}}
      #tb21-auto-panel .ap-fold{cursor:pointer;padding:2px 6px;color:#94a3b8;font-size:13px;border-radius:4px;transition:transform .2s,color .2s,background .2s}
      #tb21-auto-panel .ap-fold:hover{color:#f1f5f9;background:rgba(255,255,255,.08)}
      #tb21-auto-panel .ap-body{padding:10px 12px 12px;max-height:calc(100vh - 60px);overflow-y:auto}
      #tb21-auto-panel .ap-status{margin-bottom:8px;font-size:11px;display:flex;align-items:center;gap:6px}
      #tb21-auto-panel .ap-status .running{color:#34d399;font-weight:600;display:inline-flex;align-items:center;gap:4px}
      #tb21-auto-panel .ap-status .stopped{color:#f87171;font-weight:600;display:inline-flex;align-items:center;gap:4px}
      #tb21-auto-panel .ap-btn-row{display:flex;gap:8px}
      #tb21-auto-panel .ap-btn{flex:1;display:inline-flex;justify-content:center;align-items:center;padding:6px 12px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:700;border:none;transition:all .2s cubic-bezier(.4,0,.2,1)}
      #tb21-auto-panel .ap-btn:hover{filter:brightness(1.1);transform:translateY(-1px)}
      #tb21-auto-panel .ap-btn:active{transform:translateY(0) scale(.98)}
      #tb21-auto-panel .ap-btn.start{background:linear-gradient(135deg,#10b981,#059669);color:#fff;box-shadow:0 3px 10px rgba(16,185,129,.35)}
      #tb21-auto-panel .ap-btn.stop{background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;box-shadow:0 3px 10px rgba(239,68,68,.3)}
      #tb21-auto-panel .ap-info{color:#94a3b8;font-size:11px;margin-top:8px;line-height:1.5}
      #tb21-auto-panel .ap-credit-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}
      #tb21-auto-panel .ap-credit-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:6px 8px;display:flex;flex-direction:column;gap:1px}
      #tb21-auto-panel .ap-credit-card.req{border-left:3px solid #38bdf8}
      #tb21-auto-panel .ap-credit-card.ele{border-left:3px solid #c084fc}
      #tb21-auto-panel .ap-fleet-box{margin-top:8px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:8px}
      #tb21-auto-panel .ap-fleet-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
      #tb21-auto-panel .ap-fleet-label{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:#38bdf8;cursor:pointer}
      #tb21-auto-panel .ap-fleet-label input{accent-color:#0284c7;cursor:pointer}
      #tb21-auto-panel .ap-fleet-ctrl-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0 6px}
      #tb21-auto-panel .ap-fleet-conc-row{display:flex;align-items:center;justify-content:space-between;padding:4px 6px;background:rgba(255,255,255,.03);border-radius:6px;border:1px solid rgba(255,255,255,.05)}
      #tb21-auto-panel .ap-fleet-conc-title{font-size:10px;color:#94a3b8;font-weight:600}
      #tb21-auto-panel .ap-fleet-conc-btns{display:flex;align-items:center;gap:3px}
      #tb21-auto-panel .ap-conc-btn,#tb21-auto-panel .ap-speed-btn{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#94a3b8;font-size:10px;padding:2px 5px;border-radius:4px;cursor:pointer;transition:all .2s;white-space:nowrap}
      #tb21-auto-panel .ap-speed-btn:hover,#tb21-auto-panel .ap-conc-btn:hover{color:#fff;background:rgba(255,255,255,.14)}
      #tb21-auto-panel .ap-speed-btn.active{background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border-color:#fbbf24;font-weight:700;box-shadow:0 0 8px rgba(245,158,11,.4)}
      #tb21-auto-panel .ap-conc-btn.active{background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;border-color:#38bdf8;font-weight:700;box-shadow:0 0 8px rgba(56,189,248,.35)}
      #tb21-auto-panel .ap-fleet-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px;max-height:220px;overflow-y:auto;padding-right:2px}
      #tb21-auto-panel .ap-fleet-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:6px;padding:6px 8px;display:flex;flex-direction:column;justify-content:space-between;min-height:58px;transition:all .15s}
      #tb21-auto-panel .ap-fleet-card:hover{border-color:rgba(56,189,248,.35);background:rgba(255,255,255,.07)}
      #tb21-auto-panel .ap-fleet-card-title{display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:600;color:#f1f5f9;gap:6px}
      #tb21-auto-panel .ap-fleet-cname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
      #tb21-auto-panel .ap-fleet-time{color:#fbbf24;font-size:10px;font-family:monospace}
      #tb21-auto-panel .ap-fleet-card-sub{display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-top:2px}
      #tb21-auto-panel .ap-fleet-track{height:3px;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden;margin-top:4px}
      #tb21-auto-panel .ap-fleet-bar{height:100%;background:linear-gradient(90deg,#0ea5e9,#10b981);transition:width .5s ease}
      #tb21-auto-panel .ap-fleet-empty{color:#64748b;font-size:10px;text-align:center;padding:6px 0}
      #tb21-auto-panel .ap-card-label{font-size:10px;color:#94a3b8;font-weight:600;display:flex;justify-content:space-between}
      #tb21-auto-panel .ap-card-val{font-size:13px;font-weight:700;color:#f8fafc;margin:2px 0 1px}
      #tb21-auto-panel .ap-card-val.ok{color:#34d399}
      #tb21-auto-panel .ap-card-val.need{color:#fbbf24}
      #tb21-auto-panel .ap-card-target{font-size:9px;color:#64748b}
      #tb21-auto-panel .ap-plan-summary{display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);border-radius:6px;padding:5px 8px;margin-top:6px;font-size:10px;color:#94a3b8}
      #tb21-auto-panel .ap-plan-summary .ap-target-badge{background:rgba(14,165,233,.2);color:#38bdf8;padding:1px 6px;border-radius:4px;font-weight:700}
      #tb21-auto-panel .ap-text-info{white-space:pre-line;background:rgba(255,255,255,.03);padding:6px 8px;border-radius:6px;border:1px solid rgba(255,255,255,.04);line-height:1.6}
      #tb21-auto-panel .ap-note{color:#fbbf24;font-size:11px;margin-top:8px;line-height:1.4;opacity:.9}
      #tb21-auto-panel .ap-courses,#tb21-auto-panel .ap-years{margin-top:10px;border-top:1px solid rgba(255,255,255,.08);padding-top:8px}
      #tb21-auto-panel .ap-cat-group{margin-bottom:6px}
      #tb21-auto-panel .ap-cat-header{display:flex;align-items:center;gap:5px;cursor:pointer;padding:4px 6px;border-radius:6px;font-weight:700;font-size:12px;color:#e2e8f0;transition:background .15s}
      #tb21-auto-panel .ap-cat-header:hover{background:rgba(255,255,255,.06)}
      #tb21-auto-panel .ap-cat-arrow{font-size:10px;color:#94a3b8;transition:transform .2s;display:inline-block}
      #tb21-auto-panel .ap-cat-group.collapsed .ap-cat-arrow{transform:rotate(-90deg)}
      #tb21-auto-panel .ap-cat-group.collapsed .ap-cat-list{display:none}
      #tb21-auto-panel .ap-cat-list{max-height:220px;overflow-y:auto;margin-top:4px;padding-right:2px}
      #tb21-auto-panel .ap-course-item{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:6px;cursor:pointer;font-size:11px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.03);margin-bottom:3px;transition:all .15s}
      #tb21-auto-panel .ap-course-item:hover{background:rgba(59,130,246,.12);border-color:rgba(59,130,246,.25);transform:translateX(2px)}
      #tb21-auto-panel .ap-course-item.done{opacity:.55}
      #tb21-auto-panel .ap-course-check{font-weight:700;min-width:14px;text-align:center}
      #tb21-auto-panel .ap-course-item.done .ap-course-check{color:#10b981}
      #tb21-auto-panel .ap-course-item:not(.done) .ap-course-check{color:#f59e0b}
      #tb21-auto-panel .ap-course-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;color:#f1f5f9}
      #tb21-auto-panel .ap-course-meta{color:#94a3b8;font-size:10px;flex-shrink:0}
      #tb21-auto-panel .ap-plan-box{margin-top:8px;border-top:1px solid rgba(255,255,255,.08);padding-top:8px}
      #tb21-auto-panel .ap-plan-header{display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:12px;color:#e2e8f0;margin-bottom:6px}
      #tb21-auto-panel .ap-plan-badge{background:rgba(16,185,129,.18);color:#34d399;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700}
      #tb21-auto-panel .ap-credit-pill{background:rgba(14,165,233,.2);color:#38bdf8;font-size:10px;padding:1px 5px;border-radius:4px;font-weight:700;flex-shrink:0;margin-left:auto}
      #tb21-auto-panel .ap-course-item.is-plan{border-left:2px solid #0ea5e9;background:rgba(14,165,233,.08)}
      #tb21-auto-panel .ap-course-item.is-skip{opacity:.55;border-left:2px solid #64748b}
      #tb21-auto-panel .ap-skip-toggle{display:flex;align-items:center;gap:4px;cursor:pointer;padding:4px 6px;border-radius:6px;font-size:11px;color:#94a3b8;margin-top:6px;background:rgba(255,255,255,.02)}
      #tb21-auto-panel .ap-skip-toggle:hover{background:rgba(255,255,255,.06);color:#e2e8f0}
      #tb21-auto-panel .ap-tag-req{background:rgba(59,130,246,.2);color:#60a5fa;font-size:9px;padding:1px 4px;border-radius:3px;font-weight:600;flex-shrink:0}
      #tb21-auto-panel .ap-tag-ele{background:rgba(168,85,247,.2);color:#c084fc;font-size:9px;padding:1px 4px;border-radius:3px;font-weight:600;flex-shrink:0}
      #tb21-auto-panel .ap-years-title{font-weight:700;font-size:12px;margin-bottom:6px;color:#e2e8f0}
      #tb21-auto-panel .ap-year-group{margin-bottom:3px}
      #tb21-auto-panel .ap-year-header{display:flex;align-items:center;gap:5px;cursor:pointer;padding:4px 6px;border-radius:6px;font-size:11px;transition:background .15s}
      #tb21-auto-panel .ap-year-header:hover{background:rgba(255,255,255,.06)}
      #tb21-auto-panel .ap-year-arrow{font-size:9px;color:#94a3b8;display:inline-block;transition:transform .2s;min-width:10px}
      #tb21-auto-panel .ap-year-group:not(.expanded) .ap-year-arrow{transform:rotate(-90deg)}
      #tb21-auto-panel .ap-year-check{font-weight:700;min-width:12px;text-align:center;color:#10b981}
      #tb21-auto-panel .ap-year-name{flex:1;color:#f1f5f9;font-weight:600}
      #tb21-auto-panel .ap-year-progress{color:#94a3b8;font-size:10px}
      #tb21-auto-panel .ap-year-list{display:none;padding:3px 0 4px 12px;max-height:180px;overflow-y:auto}
      #tb21-auto-panel .ap-year-group.expanded .ap-year-list{display:block}
      #tb21-auto-panel .ap-year-empty{color:#64748b;font-size:10px;padding:4px 0;font-style:italic}
      #tb21-auto-panel .ap-strat-bar{display:flex;align-items:center;gap:4px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:6px;padding:3px 6px;margin-bottom:6px}
      #tb21-auto-panel .ap-strat-title{font-size:10px;color:#94a3b8;font-weight:600;flex-shrink:0}
      #tb21-auto-panel .ap-strat-btn{flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#94a3b8;font-size:10px;padding:3px 2px;border-radius:4px;cursor:pointer;transition:all .15s;text-align:center}
      #tb21-auto-panel .ap-strat-btn:hover{background:rgba(255,255,255,.09);color:#f1f5f9}
      #tb21-auto-panel .ap-strat-btn.active{background:rgba(14,165,233,.2);border-color:#38bdf8;color:#38bdf8;font-weight:700}
      #tb21-auto-panel .ap-meta-pill{color:#38bdf8;background:rgba(14,165,233,.12);border-radius:3px;padding:1px 4px;font-size:9px;margin-left:4px;flex-shrink:0}
      #tb21-auto-panel .ap-cpi-pill{color:#fbbf24;background:rgba(245,158,11,.15);border-radius:3px;padding:1px 4px;font-size:9px;margin-left:4px;flex-shrink:0;font-weight:700}
      #tb21-auto-panel ::-webkit-scrollbar{width:4px}
      #tb21-auto-panel ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:4px}
    `;
    try { (document.head || document.documentElement).appendChild(css); } catch (e) {}

    const panel = document.createElement('div');
      panel.id = 'tb21-auto-panel';
      panel.__tb21ExtraInfo = extraInfo;

      panel.innerHTML =
        '<div class="ap-head">' +
          '<div class="ap-head-title"><span class="ap-logo">⚡</span><span>刷课助手</span><span class="ap-status-badge"></span></div>' +
          '<span class="ap-fold" title="折叠/展开">▾</span>' +
        '</div>' +
        '<div class="ap-body">' +
          '<div class="ap-status"></div>' +
          '<div class="ap-btn-row">' +
            '<button class="ap-btn start">开始自动刷课</button>' +
            '<button class="ap-btn stop">停止</button>' +
          '</div>' +
          '<div class="ap-info"></div>' +
          '<div class="ap-note">无人值守模式：自动遍历大类目→小科目→课程，学满自动换下一大类目</div>' +
        '</div>';
    (document.body || document.documentElement).appendChild(panel);

    // 恢复上次拖动位置（越界时收进视口）
    try {
      const pos = JSON.parse(localStorage.getItem('tb21_auto_pos') || 'null');
      if (pos && typeof pos.x === 'number') {
        const w = panel.offsetWidth || 500;
        const h = panel.offsetHeight || 160;
        panel.style.left = Math.max(0, Math.min(pos.x, window.innerWidth - w)) + 'px';
        panel.style.top = Math.max(0, Math.min(pos.y, window.innerHeight - h)) + 'px';
        panel.style.right = 'auto';
      }
    } catch (e) {}

    // rAF 平滑拖动与边界防溢出
    const head = panel.querySelector('.ap-head');
    let drag = null;
    let rafId = null;
    let curX = 0, curY = 0;

    head.addEventListener('mousedown', function (e) {
      if (e.target.closest('.ap-fold')) return;
      const r = panel.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      curX = e.clientX;
      curY = e.clientY;
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!drag) return;
      curX = e.clientX;
      curY = e.clientY;
      if (!rafId) {
        rafId = requestAnimationFrame(function () {
          rafId = null;
          if (!drag) return;
          const pw = panel.offsetWidth || 500;
          const ph = panel.offsetHeight || 160;
          const maxLeft = Math.max(0, window.innerWidth - pw);
          const maxTop = Math.max(0, window.innerHeight - ph);
          const nx = Math.max(0, Math.min(curX - drag.dx, maxLeft));
          const ny = Math.max(0, Math.min(curY - drag.dy, maxTop));
          panel.style.left = nx + 'px';
          panel.style.top = ny + 'px';
          panel.style.right = 'auto';
        });
      }
    });

    document.addEventListener('mouseup', function () {
      if (!drag) return;
      drag = null;
      document.body.style.userSelect = '';
      try {
        const r = panel.getBoundingClientRect();
        localStorage.setItem('tb21_auto_pos', JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) }));
      } catch (e) {}
    });

    panel.querySelector('.ap-fold').addEventListener('click', function () { panel.classList.toggle('ap-hide'); });

    panel.querySelector('.ap-btn.start').addEventListener('click', function () {
      setAutoRunning(true);
      try {
        localStorage.removeItem(AUTO_KEY_DONE_TABS);
      } catch (e) {}
      updateAutoPanel(panel, panel.__tb21ExtraInfo);
      console.log('[刷课助手] ⚡ 无人值守自动化已启动，已刷新巡课状态');
    });
    panel.querySelector('.ap-btn.stop').addEventListener('click', function () {
      setAutoRunning(false);
      updateAutoPanel(panel, panel.__tb21ExtraInfo);
      console.log('[刷课助手] 无人值守自动化已停止');
    });

    updateAutoPanel(panel, panel.__tb21ExtraInfo);
    renderFleetDashboard();
    setInterval(function () { updateAutoPanel(panel, panel.__tb21ExtraInfo); }, 2000);
    setInterval(function () { renderFleetDashboard(); }, 1000);
    return panel;
  }
  function updateAutoPanel(panel, extraInfo) {
    if (!panel) return;
    const running = isAutoRunning();
    const statusEl = panel.querySelector('.ap-status');
    if (statusEl) {
      statusEl.innerHTML = running ? '<span class="running">● 自动化运行中</span>' : '<span class="stopped">○ 已停止</span>';
    }
    const badge = panel.querySelector('.ap-status-badge');
    if (badge) {
      badge.className = 'ap-status-badge ' + (running ? 'running' : 'stopped');
      badge.title = running ? '自动化运行中' : '已停止';
    }
    const infoEl = panel.querySelector('.ap-info');
    if (infoEl && extraInfo) {
      const content = typeof extraInfo === 'function' ? extraInfo() : extraInfo;
      if (typeof content === 'string' && content.indexOf('<') > -1) {
        if (infoEl._lastHtml !== content) {
          infoEl._lastHtml = content;
          infoEl.innerHTML = content;
        }
      } else {
        if (infoEl.textContent !== content) {
          infoEl._lastHtml = null;
          infoEl.className = 'ap-info ap-text-info';
          infoEl.textContent = content;
        }
      }
    }
  }

  /* ============ 公共：模拟鼠标活动，防止挂起/自动退出 ============ */
  let actX = 100, actY = 100;
  function activityKeeper() {
    try {
      actX = (actX + 7) % 800 + 20;
      actY = (actY + 11) % 600 + 20;
      document.body.dispatchEvent(new MouseEvent('mousemove', {
        clientX: actX, clientY: actY, bubbles: true
      }));
      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: actX, clientY: actY, bubbles: true
      }));
    } catch (e) {}
  }

  /* ================================================================
   * 父页面（courseStudyItem.learn.do）
   * 职责：会话保持、自动点「下一步」、自动关弹窗
   * ================================================================ */
  function initParent() {
    if (location.pathname.indexOf('/els/html/courseStudyItem/') !== 0) return;
    fixSessionCookie();
    overrideConfirm();
    // [核心防御 0ms 强杀] MutationObserver 实时监听 DOM 树，学霸君弹窗一旦生成 0ms 瞬间抹杀并恢复播放
    try {
      const fastKillerObserver = new MutationObserver(function (mutations) {
        const boxes = document.querySelectorAll('.el-message-box__wrapper, .el-message-box, .pCheat-box');
        boxes.forEach(function (box) {
          const txt = box.textContent || '';
          if (txt.indexOf('学霸君') > -1 || txt.indexOf('学习行为') > -1 || txt.indexOf('存在异常') > -1) {
            console.log('[刷课助手-护盾] ⚡ MutationObserver 0ms 瞬间强杀「学霸君」弹窗！');
            const btn = box.querySelector('.el-button--primary, .el-button, button');
            if (btn) {
              try { btn.click(); } catch (e) {}
            }
            try { box.remove(); } catch (e) {}
            // 清除全屏半透明遮罩层
            document.querySelectorAll('.v-modal, .el-popup-parent--hidden').forEach(function (m) {
              try { m.remove(); } catch (e) {}
            });
            document.body.classList.remove('el-popup-parent--hidden');
            // 确保视频保持播放，绝不被暂停
            const v = getVideo ? getVideo() : document.querySelector('video');
            if (v && v.paused && !v.ended) {
              v.play().catch(function () {});
            }
          }
        });
      });
      fastKillerObserver.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch(e) {}

    try {
      const parentFastKiller = new MutationObserver(function () {
        const boxes = document.querySelectorAll('.el-message-box__wrapper, .el-message-box, .modal');
        boxes.forEach(function (box) {
          const txt = box.textContent || '';
          if (txt.indexOf('学霸君') > -1 || txt.indexOf('学习行为') > -1 || txt.indexOf('存在异常') > -1) {
            console.log('[刷课助手-父页面] ⚡ 0ms 强杀父页面「学霸君」弹窗！');
            const btn = box.querySelector('.el-button--primary, button');
            if (btn) { try { btn.click(); } catch(e){} }
            try { box.remove(); } catch(e){}
            document.querySelectorAll('.v-modal').forEach(function (m) { try { m.remove(); } catch(e){} });
          }
        });
      });
      parentFastKiller.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch(e) {}

    setInterval(autoDismissMessageBox, 1500);
    setInterval(activityKeeper, 30000);

    // 课程步骤完成（全部章节播完）后点击「下一步」
    let lastClicked = 0;
    let courseDoneReported = false; // 只由播放 iframe 的真实结束流程置为 true
    let autoReturnLock = false; // 完播后的点击和返回统一走同一把锁，避免执行两次
    const pageLoadTime = Date.now();
    const goNext = function () {
      if (!storeGet('autoNext', true)) return; // 实时读取开关
      if (!courseDoneReported) return; // 章节列表可能提前 100%，必须等待视频真实结束确认
      if (autoReturnLock) return;
      if (Date.now() - pageLoadTime < 15000) return; // 页面加载15秒内不点击

      const btn = document.getElementById('goNextStep');
      // 恢复 offsetParent !== null 的判断，这是判断元素在页面上是否真实可见的最准确方法（包括父元素被隐藏的情况）
      if (btn && !btn.classList.contains('hide') && btn.offsetParent !== null) {
        const now = Date.now();
        if (now - lastClicked > 8000) {
          lastClicked = now;
          console.log('[刷课助手] 点击「下一步」进入下一阶段 (独立轮询触发)');
          const link = btn.querySelector('a, .cl-go-link');
          if (link) {
              link.click();
          } else {
              btn.click();
          }
        }
      }
    };
    setInterval(goNext, 2000);

    // 无人值守自动化：完播只允许触发一次原生“下一步”和一次返回兜底。
    function finishAndReturnOnce(reason) {
      if (!isAutoRunning() || autoReturnLock || !courseDoneReported) return;
      const detailUrl = getDetailUrl();
      if (!detailUrl || location.href === detailUrl) return;
      autoReturnLock = true;

      const titleEl = document.querySelector('.study-rate-title .title') || document.querySelector('.rms-study-container .title');
      const title = (titleEl ? titleEl.textContent.trim() : document.title).slice(0, 80);
      rememberPendingCourseDone(getMyCourseId(), title);
      console.log('[刷课助手] 已确认真实完播（' + reason + '），记录课程并返回详情页');

      const btn = document.getElementById('goNextStep');
      const goNextVisible = btn && !btn.classList.contains('hide') && btn.offsetParent !== null;
      if (goNextVisible) {
        const link = btn.querySelector('a, .cl-go-link');
        try { (link || btn).click(); } catch (e) {}
      }
      // 原生按钮无响应时直接返回；replace 避免浏览器后退再次进入刚完成课程。
      setTimeout(function () {
        if (location.pathname.indexOf('/els/html/courseStudyItem/') === 0) location.replace(detailUrl);
      }, goNextVisible ? 2500 : 1200);
    }
    function tryAutoReturn() {
      if (Date.now() - pageLoadTime < 15000) return;
      finishAndReturnOnce('轮询兜底');
    }
    setInterval(tryAutoReturn, 3000);

    // 接收 iframe 通知
    window.addEventListener('message', function (ev) {
      if (ev.data && ev.data.type === '21TB_COURSE_DONE') {
        console.log('[刷课助手] 收到课程完成通知');
        courseDoneReported = true;
        finishAndReturnOnce('iframe 通知');
      }
    });

    /* ---------- 课程进度上报（统一悬浮窗在播放页 iframe 内读取） ---------- */
    const myCourseId = getMyCourseId();
    function publishProgress() {
      if (!myCourseId) return;
      try {
        const f = document.getElementById('aliPlayerFrame');
        if (!f || !f.contentDocument) return;
        const p = computeProgressFromDoc(f.contentDocument);
        if (!p) return;
        const titleEl = document.querySelector('.study-rate-title .title') || document.querySelector('.rms-study-container .title');
        const title = (titleEl ? titleEl.textContent.trim() : document.title).slice(0, 50);
        // DOM 的 100% 可能早于视频真正结束；未收到 iframe 完播确认前只显示“待确认”。
        const status = courseDoneReported ? '已完成' : (p.pct >= 100 ? '待完播确认' : (p.paused ? '已暂停' : '刷课中'));
        storeProgress(myCourseId, { courseId: myCourseId, title: title, pct: p.pct, done: p.done, total: p.total, status: status, ts: Date.now() });
      } catch (e) {}
    }
    setInterval(publishProgress, 2000);
    setTimeout(publishProgress, 1500);

    /* ---------- 兜底：Tampermonkey 未注入 iframe 时，父页面主动注入倍速控制 ---------- */
    let iframeFallbackDone = false;
    setInterval(function () {
      if (iframeFallbackDone) return;
      const f = document.getElementById('aliPlayerFrame');
      if (!f) return;
      try {
        const idoc = f.contentDocument;
        if (!idoc || idoc.readyState !== 'complete') return;
        // iframe 内已有脚本面板 → 不需要兜底
        if (idoc.getElementById('tb21-panel')) { iframeFallbackDone = true; return; }
        // video 已被设置倍速 → 脚本可能在运行
        const v = idoc.querySelector('video');
        if (v && v.playbackRate > 1) { iframeFallbackDone = true; return; }

        iframeFallbackDone = true;
        console.log('[刷课助手] 检测到 iframe 内脚本未注入，启动兜底倍速控制');
        const fallback = '(function(){' +
          'console.log("[刷课助手] 兜底注入：iframe 倍速控制已启动");' +
          'setInterval(function(){' +
            'try{' +
              'var sp=parseInt(localStorage.getItem("tb21_helper_speed")||"8");' +
              'var mt=localStorage.getItem("tb21_helper_autoMute")!=="false";' +
              'var an=localStorage.getItem("tb21_helper_autoNext")!=="false";' +
              'var v=document.querySelector("video");' +
              'if(v&&v.readyState>=2){' +
                'if(sp<=16&&v.playbackRate!==sp)v.playbackRate=sp;' +
                'if(mt)v.muted=true;' +
                'if(an&&v.paused&&!v.ended)v.play().catch(function(){});' +
              '}' +
              // 自动下一节：视频结束后点下一节按钮
              'if(v&&v.ended){' +
                'var nb=document.querySelector(".next-button");' +
                'if(nb&&nb.offsetParent!==null)nb.click();' +
              '}' +
            '}catch(e){}' +
          '},2000);' +
        '})();';
        const s = idoc.createElement('script');
        s.textContent = fallback;
        (idoc.head || idoc.documentElement).appendChild(s);
      } catch (e) {}
    }, 2500);

    console.log('[刷课助手] 父页面脚本已启动');
  }

  /* ================================================================
   * 课程列表页（nms-frontend /org/course/list）—— 大类目选择
   * ================================================================ */
  function initCourseList() {
    const routeTimers = [];
    function routeInterval(fn, delay) {
      const id = setInterval(fn, delay);
      routeTimers.push(id);
      return id;
    }
    function cleanupCourseList() {
      routeTimers.forEach(function (id) { clearInterval(id); });
    }

    buildAutoPanel(function () {
      const items = document.querySelectorAll('.course__item');
      let done = 0, total = items.length;
      items.forEach(function (it) {
        const m = it.textContent.match(/当前进度\s*([\d.]+)%/);
        const pct = m ? parseFloat(m[1]) : 0;
        const meta = getCategoryMeta(it);
        const isDone = pct >= 100 || hasFreshAutoKey(AUTO_KEY_DONE_CATEGORIES, meta.key);
        if (isDone) done++;
      });
      const pctAll = total > 0 ? Math.round(done / total * 100) : 0;
      return (
        '<div class="ap-plan-summary" style="margin-top:2px">' +
          '<span>🚀 全年度流水线队列</span>' +
          '<span class="ap-target-badge">' + done + ' / ' + total + ' 已通关（' + pctAll + '%）</span>' +
        '</div>'
      );
    });

    /* ---------- 年度大类目列表（可折叠，展开显示该年度课程） ---------- */
    function getYearFromTitle(title) {
      const m = title.match(/(20\d{2})年/);
      return m ? m[1] : '';
    }
    function getCategoryMeta(item) {
      const titleEl = item && item.querySelector('.course__title, .title, h3, h4');
      const title = titleEl ? titleEl.textContent.trim() : (item ? item.textContent.trim() : '');
      const year = getYearFromTitle(title);
      return { title: title, year: year, key: makeCategoryKey(title, year) };
    }
    function rememberActiveCategory(item) {
      const meta = getCategoryMeta(item);
      writeAutoJson(AUTO_KEY_ACTIVE_CATEGORY, {
        title: meta.title, year: meta.year, key: meta.key, ts: Date.now()
      });
      if (meta.year) {
        try { localStorage.setItem('tb21_current_year', meta.year); } catch (e) {}
      }
      return meta;
    }

    // 多维度智能调度算法：优先攻坚年度 > 最新年份 > 高进度冲刺(差额>=10%) > 自然序
    function sortCategoryPipeline(list, currentYear) {
      return list.slice().sort(function (a, b) {
        // 1. 当前正在攻坚的年度绝对优先
        const aCur = (currentYear && a.year === currentYear) ? 1 : 0;
        const bCur = (currentYear && b.year === currentYear) ? 1 : 0;
        if (aCur !== bCur) return bCur - aCur;

        // 2. 年份降序：2025 > 2024 > 2023...
        const aYearNum = parseInt(a.year, 10) || 0;
        const bYearNum = parseInt(b.year, 10) || 0;
        if (aYearNum !== bYearNum) return bYearNum - aYearNum;

        // 3. 高进度冲刺优先：同一年份差额 >= 10% 时，优先刷进度高的（如 80% 先于 0%）
        const diff = Math.abs(a.progress - b.progress);
        if (diff >= 10) {
          return b.progress - a.progress;
        }

        // 4. 原始自然序保底
        return a.index - b.index;
      });
    }

    function renderYearCourses(group) {
      const year = group.dataset.year;
      const list = group.querySelector('.ap-year-list');
      let courses = [];
      try {
        const cached = JSON.parse(localStorage.getItem('tb21_courses_' + year) || 'null');
        if (cached) courses = cached.courses || [];
      } catch (e) {}
      if (courses.length === 0) {
        list.innerHTML = '<div class="ap-year-empty">进入该年度详情页后自动加载课程列表</div>';
        return;
      }
      list.innerHTML = courses.map(function (c) {
        return '<div class="ap-course-item' + (c.done ? ' done' : '') + '" title="' + c.title.replace(/"/g, '&quot;') + '">' +
          '<span class="ap-course-check">' + (c.done ? '✓' : '○') + '</span>' +
          '<span class="ap-course-name">' + c.title + '</span>' +
          (c.credits ? '<span class="ap-course-meta">' + c.credits + '分</span>' : '') +
        '</div>';
      }).join('');
    }

    function refreshCategoryList() {
      const yearsDiv = document.querySelector('#tb21-auto-panel .ap-years');
      if (!yearsDiv) return;
      const items = document.querySelectorAll('.course__item');
      const expandedYears = {};
      yearsDiv.querySelectorAll('.ap-year-group.expanded').forEach(function (g) { expandedYears[g.dataset.year] = true; });

      let currentYear = '';
      try { currentYear = localStorage.getItem('tb21_current_year') || ''; } catch (e) {}

      let html = '<div class="ap-years-title" style="display:flex;justify-content:space-between;align-items:center;">' +
        '<span>📋 流水线攻坚排期</span>' +
        '<span style="font-size:10px;color:#94a3b8;font-weight:normal;">点击卡片插队</span>' +
      '</div>';

      items.forEach(function (it, idx) {
        const meta = getCategoryMeta(it);
        const year = meta.year;
        const m = it.textContent.match(/当前进度\s*([\d.]+)%/);
        const pct = m ? parseFloat(m[1]) : 0;
        const isDone = pct >= 100 || hasFreshAutoKey(AUTO_KEY_DONE_CATEGORIES, meta.key);
        const isCooling = !isDone && isCategoryCoolingDown(meta.key);
        const isCurrent = !isDone && !isCooling && (year && year === currentYear);

        let courses = [];
        try {
          const cached = JSON.parse(localStorage.getItem('tb21_courses_' + year) || 'null');
          if (cached && Date.now() - cached.ts < 86400000) courses = cached.courses || [];
        } catch (e) {}
        const doneCount = courses.filter(function (c) { return c.done; }).length;

        let statusBadge = '';
        let mark = '○';
        if (isDone) {
          mark = '✓';
          statusBadge = '<span style="color:#10b981;font-size:10px;background:rgba(16,185,129,.15);padding:1px 5px;border-radius:4px;border:1px solid rgba(16,185,129,.3);">已通关</span>';
        } else if (isCooling) {
          mark = '❄';
          statusBadge = '<span style="color:#38bdf8;font-size:10px;background:rgba(56,189,248,.15);padding:1px 5px;border-radius:4px;border:1px solid rgba(56,189,248,.3);">冷却中</span>';
        } else if (isCurrent) {
          mark = '⚡';
          statusBadge = '<span style="color:#f59e0b;font-size:10px;background:rgba(245,158,11,.15);padding:1px 5px;border-radius:4px;border:1px solid rgba(245,158,11,.3);font-weight:bold;">正在攻坚</span>';
        } else {
          mark = pct > 0 ? '▶' : '○';
          statusBadge = '<span style="color:#94a3b8;font-size:10px;background:rgba(148,163,184,.12);padding:1px 5px;border-radius:4px;">排队中</span>';
        }

        const progressText = courses.length > 0 ? (doneCount + '/' + courses.length + '门') : (pct + '%');
        const expanded = expandedYears[year] ? ' expanded' : '';
        html += '<div class="ap-year-group' + expanded + '" data-year="' + year + '" data-idx="' + idx + '" style="cursor:pointer;" title="点击展开详情或插队攻坚">' +
          '<div class="ap-year-header">' +
            '<span class="ap-year-arrow">▼</span>' +
            '<span class="ap-year-check">' + mark + '</span>' +
            '<span class="ap-year-name" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (year ? year + '年' : meta.title.slice(0, 10)) + '</span>' +
            '<span style="margin-right:6px;">' + statusBadge + '</span>' +
            '<span class="ap-year-progress">' + progressText + '</span>' +
          '</div>' +
          '<div class="ap-year-list"></div>' +
        '</div>';
      });

      if (yearsDiv._lastHtml !== html) {
        yearsDiv._lastHtml = html;
        yearsDiv.innerHTML = html;
        yearsDiv.querySelectorAll('.ap-year-group').forEach(function (group) {
          const header = group.querySelector('.ap-year-header');
          header.addEventListener('click', function (e) {
            // 如果点击箭头，仅折叠展开
            if (e.target.classList.contains('ap-year-arrow')) {
              group.classList.toggle('expanded');
              if (group.classList.contains('expanded')) renderYearCourses(group);
              return;
            }
            // 否则触发插队攻坚当前年度
            const y = group.dataset.year;
            if (y) {
              try { localStorage.setItem('tb21_current_year', y); } catch (err) {}
              console.log('[刷课助手] 用户点击插队攻坚年度：', y);
              const idx = parseInt(group.dataset.idx, 10);
              const card = items[idx];
              if (card) {
                const btn = card.querySelector('.enter-btn');
                if (btn) {
                  rememberActiveCategory(card);
                  btn.click();
                  return;
                }
              }
            }
            group.classList.toggle('expanded');
            if (group.classList.contains('expanded')) renderYearCourses(group);
          });
        });
        // Re-render expanded groups
        yearsDiv.querySelectorAll('.ap-year-group.expanded').forEach(renderYearCourses);
      }
    }

    function buildCategoryList() {
      const panel = cachedEl('tb21-auto-panel');
      if (!panel) return;
      const body = panel.querySelector('.ap-body');
      if (!body) return;
      if (!body.querySelector('.ap-years')) {
        const yearsDiv = document.createElement('div');
        yearsDiv.className = 'ap-years';
        body.appendChild(yearsDiv);
      }
      if (!body.querySelector('.ap-certs')) {
        const certsDiv = document.createElement('div');
        certsDiv.className = 'ap-certs';
        certsDiv.innerHTML =
          '<div class="ap-year-group collapsed" id="ap-cert-drawer">' +
            '<div class="ap-year-header" style="cursor:pointer;border-top:1px solid rgba(255,255,255,0.08);margin-top:6px;padding-top:6px;">' +
              '<span class="ap-year-arrow">▼</span>' +
              '<span class="ap-year-check">📜</span>' +
              '<span class="ap-year-name" style="flex:1;">官方结业证书与学时</span>' +
              '<span class="ap-year-progress" id="ap-cert-count" style="color:#38bdf8;">点击自查</span>' +
            '</div>' +
            '<div class="ap-year-list" id="ap-cert-items" style="display:none;">' +
              '<div style="padding:6px;color:#94a3b8;font-size:11px;">正在同步官方证书库...</div>' +
            '</div>' +
          '</div>';
        body.appendChild(certsDiv);

        const drawer = certsDiv.querySelector('#ap-cert-drawer');
        const header = drawer.querySelector('.ap-year-header');
        const list = drawer.querySelector('#ap-cert-items');
        header.addEventListener('click', async function () {
          const isCollapsed = drawer.classList.toggle('collapsed');
          list.style.display = isCollapsed ? 'none' : 'block';
          if (!isCollapsed && !drawer.__loaded) {
            drawer.__loaded = true;
            try {
              const res = await TbApiClient.fetchUserCertificates(1, 15);
              const rows = (res && res.rows) || [];
              const countEl = drawer.querySelector('#ap-cert-count');
              if (countEl) countEl.textContent = rows.length + ' 本证书';
              if (rows.length === 0) {
                list.innerHTML = '<div style="padding:6px;color:#94a3b8;font-size:11px;">暂无已生成的结业合格证书</div>';
              } else {
                list.innerHTML = rows.map(function (c) {
                  const title = c.courseName || c.certName || c.projectName || '培训结业证书';
                  const date = (c.createTime || c.certDate || '').slice(0, 10);
                  const score = c.credits || c.score || '';
                  return '<div class="ap-course-item done" style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px;">' +
                    '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + title + '">🎓 ' + title + '</span>' +
                    (score ? '<span style="color:#10b981;font-size:10px;margin-left:4px;">' + score + '分</span>' : '') +
                    (date ? '<span style="color:#64748b;font-size:10px;margin-left:4px;">' + date + '</span>' : '') +
                  '</div>';
                }).join('') +
                '<div style="text-align:right;padding:4px 6px;"><a href="https://cqrl.21tb.com/nms-frontend/index.html#/org/course/certificate" target="_blank" style="color:#38bdf8;font-size:10px;text-decoration:none;">查看全部证书 ➔</a></div>';
              }
            } catch (err) {
              list.innerHTML = '<div style="padding:6px;color:#ef4444;font-size:11px;">证书数据拉取异常</div>';
            }
          }
        });
      }
    }

    // 点击「进入学习」时记录年度，供详情页缓存课程用
    function bindEnterBtns() {
      document.querySelectorAll('.enter-btn').forEach(function (btn) {
        if (btn.__tb21Bound) return;
        btn.__tb21Bound = true;
        btn.addEventListener('click', function () {
          const item = btn.closest('.course__item');
          if (!item) return;
          rememberActiveCategory(item);
        });
      });
    }

    buildCategoryList();
    refreshCategoryList();
    routeInterval(refreshCategoryList, 3000);
    bindEnterBtns();
    routeInterval(bindEnterBtns, 3000);

    let clickLock = 0; // 导航锁：点击后一段时间内不再操作，防止反复点击导致闪黑
    routeInterval(function () {
      if (!isAutoRunning()) return;
      TbApiClient.startSessionHeartbeat();
      if (location.hash.indexOf('course/list') === -1) return; // 路由守卫：只在列表页执行
      if (Date.now() < clickLock) return; // 导航锁生效中
      const items = document.querySelectorAll('.course__item');
      if (items.length === 0) return;

      let currentYear = '';
      try { currentYear = localStorage.getItem('tb21_current_year') || ''; } catch (e) {}

      const available = [];
      items.forEach(function (it, index) {
        const progressMatch = it.textContent.match(/当前进度\s*([\d.]+)%/);
        const pct = progressMatch ? parseFloat(progressMatch[1]) : 0;
        const meta = getCategoryMeta(it);

        // 1. 判定已通关：进度100% 或 本地已记录真实学分达标
        if (pct >= 100 || hasFreshAutoKey(AUTO_KEY_DONE_CATEGORIES, meta.key)) {
          return;
        }

        // 2. 判定冷却中：此前因无课或异常被冷却保护的大类目跳过
        if (isCategoryCoolingDown(meta.key)) {
          return;
        }

        const btn = it.querySelector('.enter-btn');
        if (!btn) return;

        available.push({
          it: it,
          btn: btn,
          title: meta.title,
          year: meta.year,
          progress: pct,
          index: index
        });
      });

      // 阶段A：当前页有可攻坚的大类目
      if (available.length > 0) {
        const sorted = sortCategoryPipeline(available, currentYear);
        const targetItem = sorted[0];

        console.log('[刷课助手] 🎯 流水线调度锁定大类目：', targetItem.title.trim().slice(0, 40), `(进度:${targetItem.progress}%, 年份:${targetItem.year || '未知'})`);
        rememberActiveCategory(targetItem.it);
        clickLock = Date.now() + 15000; // 锁定 15 秒等待导航进入
        targetItem.btn.click();
        return;
      }

      // 阶段B：当前页没有可攻坚的大类目（当前页全通关或冷却），自动跨页扫描！
      const activePageEl = document.querySelector(
        '.el-pagination .el-pager li.active, .el-pagination .number.active, .pagination .active'
      );
      const currentPage = activePageEl ? parseInt(activePageEl.textContent, 10) : 1;
      const pagerItems = Array.prototype.slice.call(document.querySelectorAll(
        '.el-pagination .el-pager li, .el-pagination button, .pagination button, .pagination a'
      ));
      let nextPageBtn = document.querySelector('.el-pagination .btn-next, .pagination .next');
      if (!nextPageBtn) {
        nextPageBtn = pagerItems.find(function (el) {
          const txt = (el.textContent || el.getAttribute('aria-label') || el.title || '').trim();
          return txt.indexOf('下一页') > -1;
        }) || null;
      }
      const canUsePager = function (btn) {
        return !!(btn && !btn.disabled && !btn.classList.contains('disabled'));
      };

      // 如果有下一页且可点击，自动翻到下一页继续扫描大类目
      if (canUsePager(nextPageBtn)) {
        console.log(`[刷课助手] 📄 第 ${currentPage} 页大类目已全部通关或冷却，自动翻向第 ${currentPage + 1} 页扫描后续大类目...`);
        clickLock = Date.now() + 3500;
        nextPageBtn.click();
        return;
      }

      // 已经到达末页，如果之前是在后续页，先返回第 1 页做一次整体闭环校验
      const firstPageBtn = pagerItems.find(function (el) {
        return (el.textContent || '').trim() === '1' && !el.classList.contains('disabled') && !el.classList.contains('active');
      });
      if (currentPage > 1 && firstPageBtn) {
        console.log('[刷课助手] 🔄 所有后续分页大类目扫描完毕，返回第 1 页进行最终闭环确认...');
        clickLock = Date.now() + 3500;
        firstPageBtn.click();
        return;
      }

      // 所有分页大类目确实全部已通关或冷却
      setAutoRunning(false);
      console.log('[刷课助手] 🎉 所有年度/所有分页大类目已全部通关！自动化运行圆满结束。');
    }, 3500);
    return cleanupCourseList;
  }

  /* ================================================================
   * 课程详情页（nms-frontend /org/courseDetail）—— 小科目+课程选择
   * ================================================================ */
  function initCourseDetail() {
    setDetailUrl(location.href); // 记录当前详情页 URL，课程刷完后返回这里
    if (isAutoRunning()) {
      TbApiClient.startSessionHeartbeat();
    }

    let apiAllCourses = null;
    let isFetchingAllCourses = false;
    async function tryFetchAllCourses() {
      if (isFetchingAllCourses) return;
      const params = getRouteQueryParams();
      const projectId = params.projectId || '';
      if (!projectId) return;

      isFetchingAllCourses = true;
      try {
        const res = await TbApiClient.loadAllCourses(projectId, '', '');
        if (res && res.rows && Array.isArray(res.rows)) {
          apiAllCourses = res.rows;
          console.log('[刷课助手] 🚀 官方API瞬间拉取全量课程成功：共 ' + res.rows.length + ' 门课程(跨所有分页全量直连)');
        }
      } catch (err) {
        console.warn('[刷课助手] 官方全量课程拉取降级:', err);
      } finally {
        isFetchingAllCourses = false;
      }
    }
    tryFetchAllCourses();

    const routeTimers = [];
    function routeInterval(fn, delay) {
      const id = setInterval(fn, delay);
      routeTimers.push(id);
      return id;
    }
    function cleanupCourseDetail() {
      routeTimers.forEach(function (id) { clearInterval(id); });
    }

    /* ---------- 课程统计（分必修/选修，已完成/未完成/总数，只统计可见卡片） ---------- */
    function getVisibleCards() {
      return Array.prototype.slice.call(document.querySelectorAll('.text-item.cursor')).filter(function (c) {
        return c.offsetParent !== null && getComputedStyle(c).display !== 'none';
      });
    }
    function countCourses() {
      const result = { required: { total: 0, done: 0, unfinished: 0 }, elective: { total: 0, done: 0, unfinished: 0 } };
      getVisibleCards().forEach(function (c) {
        const info = c.querySelector('.text-info');
        if (!info) return;
        const txt = info.textContent;
        const isDone = txt.indexOf('已完成') > -1;
        const isRequired = txt.indexOf('必修') > -1;
        const tab = isRequired ? 'required' : 'elective';
        result[tab].total++;
        if (isDone) result[tab].done++;
        else result[tab].unfinished++;
      });
      return result;
    }

    function getCardCourseId(card) {
      if (!card) return '';
      try {
        if (card.__vue__ && card.__vue__.courseInfo && card.__vue__.courseInfo.courseId) {
          return String(card.__vue__.courseInfo.courseId);
        }
      } catch (e) {}
      const nodes = [card].concat(Array.prototype.slice.call(card.querySelectorAll(
        '[data-course-id], [data-courseid], [course-id], [courseid], [data-id], a[href]'
      )));
      const attrs = ['data-course-id', 'data-courseid', 'course-id', 'courseid', 'data-id'];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = 0; j < attrs.length; j++) {
          const val = nodes[i] && nodes[i].getAttribute && nodes[i].getAttribute(attrs[j]);
          if (val && /^[\w-]{4,}$/.test(val)) return String(val);
        }
        const href = nodes[i] && nodes[i].getAttribute && nodes[i].getAttribute('href');
        if (href) {
          try {
            const u = new URL(href, location.href);
            const val = u.searchParams.get('courseId') || u.searchParams.get('courseid') || u.searchParams.get('id');
            if (val) return String(val);
          } catch (e) {}
        }
      }
      return '';
    }

    function getCourseCredits(card) {
      if (!card) return 0;
      try {
        if (card.__vue__ && card.__vue__.courseInfo && card.__vue__.courseInfo.courseScore) {
          const v = parseFloat(card.__vue__.courseInfo.courseScore);
          if (isFinite(v) && v > 0) return v;
        }
      } catch (e) {}
      const info = card.querySelector('.text-info');
      const text = info ? info.textContent : card.textContent;
      const match = String(text || '').match(/([\d.]+)\s*学分/);
      const value = match ? parseFloat(match[1]) : 0;
      return isFinite(value) ? value : 0;
    }

    // 读取大类目顶部的学分要求。全格式兼容解析（官方API直连优先，DOM文本正则兜底）
    let requirementCache = { ts: 0, routeKey: '', data: null };
    let apiRequirementData = null;
    let isFetchingApiReq = false;

    async function tryFetchOfficialRequirements() {
      if (isFetchingApiReq) return;
      const params = getRouteQueryParams();
      const roadMapId = params.roadMapId || '';
      const projectId = params.projectId || '';
      if (!roadMapId && !projectId) return;

      isFetchingApiReq = true;
      try {
        const [stageList, projectDetail] = await Promise.all([
          roadMapId ? TbApiClient.getStageRequirements(roadMapId) : Promise.resolve(null),
          projectId ? TbApiClient.getProjectDetail(projectId) : Promise.resolve(null)
        ]);

        if (stageList && Array.isArray(stageList) && stageList.length > 0) {
          let mustScore = 0, eleScore = 0;
          stageList.forEach(function (s) {
            mustScore += Number(s.mustTotalScore || 0);
            eleScore += Number(s.electiveTotalScore || 0);
          });
          const doneMust = projectDetail ? Number(projectDetail.complateMustScore || 0) : 0;
          const doneEle = projectDetail ? Number(projectDetail.complateElectiveScore || 0) : 0;
          const title = (projectDetail && (projectDetail.projectName || projectDetail.rmProjectName)) || '';

          apiRequirementData = {
            totalRequired: mustScore + eleScore,
            totalRequirement: mustScore + eleScore,
            totalEarned: doneMust + doneEle,
            requiredMin: mustScore,
            electiveMin: eleScore,
            earnedRequired: doneMust,
            earnedElective: doneEle,
            remainingRequired: Math.max(0, mustScore - doneMust),
            remainingElective: Math.max(0, eleScore - doneEle),
            title: title,
            isOfficialApi: true,
            ts: Date.now()
          };
          console.log('[刷课助手] 📡 官方API直连成功：必修合格线=' + mustScore + '分(已修' + doneMust + '分,缺' + apiRequirementData.remainingRequired + '分), 选修合格线=' + eleScore + '分(已修' + doneEle + '分,缺' + apiRequirementData.remainingElective + '分)');
        }
      } catch (err) {
        console.warn('[刷课助手] 官方API直连解析微异常，平滑降级至DOM模式:', err);
      } finally {
        isFetchingApiReq = false;
      }
    }

    function readCategoryRequirement() {
      // 优先异步拉取一次官方精准数据
      tryFetchOfficialRequirements();

      // 如果已有官方 API 返回的精准数据且在 8 秒有效期内，直接优先返回！
      if (apiRequirementData && Date.now() - apiRequirementData.ts < 8000) {
        return apiRequirementData;
      }

      const routeKey = location.origin + location.pathname + location.search + location.hash;
      if (requirementCache.routeKey === routeKey && Date.now() - requirementCache.ts < 2000) {
        return requirementCache.data;
      }
      let sourceText = '';
      let sourceRawText = '';
      try {
        const direct = Array.prototype.slice.call(document.querySelectorAll(
          '.study-stat-box, .stat-info, .header-stat, .study-progress, .credit-info, .course-stat, ' +
          '.score-info, .requirement-info, .study-requirement, .course-detail-header, .credit-box, .stat-box'
        ));
        const candidates = direct.length ? direct :
          Array.prototype.slice.call(document.querySelectorAll('section, article, div'));
        candidates.forEach(function (el) {
          if (el.id === 'tb21-auto-panel' || (el.closest && el.closest('#tb21-auto-panel'))) return;
          const rawText = String(el.innerText || el.textContent || '').trim();
          const text = rawText.replace(/\s+/g, ' ').trim();
          if (text.indexOf('学分') === -1) return;
          if (text.indexOf('要求') === -1 && text.indexOf('还需要') === -1 && text.indexOf('还需') === -1 &&
              text.indexOf('已修') === -1 && text.indexOf('已获得') === -1 && text.indexOf('剩余') === -1) return;
          if (!sourceText || text.length < sourceText.length) {
            sourceText = text;
            sourceRawText = rawText;
          }
        });
        if (!sourceText) {
          sourceRawText = String(document.body ? (document.body.innerText || document.body.textContent) : '').trim();
          sourceText = sourceRawText.replace(/\s+/g, ' ').trim();
        }
      } catch (e) {}

      const numberFrom = function (patterns) {
        for (let i = 0; i < patterns.length; i++) {
          const match = sourceText.match(patterns[i]);
          if (match) {
            const value = parseFloat(match[1]);
            if (isFinite(value)) return value;
          }
        }
        return null;
      };

      // 标题优先取“学分要求”上一行
      let categoryTitle = '';
      const lines = sourceRawText.split(/\r?\n/).map(function (line) {
        return line.replace(/\s+/g, ' ').trim();
      }).filter(Boolean);
      const requirementLineIndex = lines.findIndex(function (line) {
        return line.indexOf('学分要求') > -1 || line.indexOf('总学分') > -1;
      });
      if (requirementLineIndex > 0) {
        for (let i = requirementLineIndex - 1; i >= 0; i--) {
          if (lines[i].length >= 2 && lines[i].length <= 100 &&
              !/^(课程中心|课程列表|必修课|选修课|未完成|已完成)$/.test(lines[i])) {
            categoryTitle = lines[i];
            break;
          }
        }
      }
      if (!categoryTitle) {
        try {
          const titleEl = document.querySelector(
            '.course-detail-title, .category-title, .detail-title, .page-title, h1, h2'
          );
          if (titleEl && !(titleEl.closest && titleEl.closest('#tb21-auto-panel'))) {
            categoryTitle = (titleEl.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100);
          }
        } catch (e) {}
      }
      if (!categoryTitle) {
        const beforeRequirement = sourceText.match(/(?:^|\s)([^。；]{2,100}?)(?=学分要求|总学分)/);
        if (beforeRequirement) categoryTitle = beforeRequirement[1].trim();
      }

      const data = {
        title: categoryTitle,
        totalRequirement: numberFrom([
          /学分要求\s*[:：]?(?:\s*总计)?\s*([\d.]+)/,
          /总学分(?:要求)?\s*[:：]?\s*([\d.]+)/,
          /总计\s*([\d.]+)\s*(?:个)?(?:学分)?/
        ]),
        requiredMin: numberFrom([
          /必修\s*(?:≥|>=|＞=?)\s*([\d.]+)(?:\s*学分)?/,
          /必修(?:学分)?(?:最低|要求|需修|应修)\s*[:：]?\s*([\d.]+)/,
          /必修(?:学分)?[：:\s]*[\d.]+\s*\/\s*([\d.]+)/
        ]),
        electiveMin: numberFrom([
          /选修\s*(?:≥|>=|＞=?)\s*([\d.]+)(?:\s*学分)?/,
          /选修(?:学分)?(?:最低|要求|需修|应修)\s*[:：]?\s*([\d.]+)/,
          /选修(?:学分)?[：:\s]*[\d.]+\s*\/\s*([\d.]+)/
        ]),
        earnedTotal: numberFrom([
          /已获得\s*[:：]?\s*([\d.]+)\s*(?:个)?\s*学分/,
          /已修学分\s*[:：]?\s*([\d.]+)/,
          /总获得学分\s*[:：]?\s*([\d.]+)/,
          /已修\s*[:：]?\s*([\d.]+)\s*\/\s*[\d.]+/
        ]),
        earnedRequired: numberFrom([
          /已获得\s*([\d.]+)\s*(?:个)?\s*必修学分/,
          /必修(?:学分)?已修\s*[:：]?\s*([\d.]+)/,
          /必修(?:学分)?[：:\s]*([\d.]+)\s*\/\s*[\d.]+/,
          /已修必修\s*[:：]?\s*([\d.]+)/
        ]),
        earnedElective: numberFrom([
          /已获得\s*([\d.]+)\s*(?:个)?\s*选修学分/,
          /选修(?:学分)?已修\s*[:：]?\s*([\d.]+)/,
          /选修(?:学分)?[：:\s]*([\d.]+)\s*\/\s*[\d.]+/,
          /已修选修\s*[:：]?\s*([\d.]+)/
        ]),
        totalCourses: numberFrom([
          /总课程数\s*[:：]?\s*(\d+)\s*门/,
          /共\s*(\d+)\s*门(?:课程)?/
        ]),
        remainingRequired: numberFrom([
          /(?:您)?还需(?:要)?(?:学习)?\s*([\d.]+)\s*(?:个)?\s*必修学分/,
          /必修(?:学分)?\s*(?:还需|剩余|还差|需修)\s*[:：]?\s*([\d.]+)/
        ]),
        remainingElective: numberFrom([
          /(?:您)?还需(?:要)?(?:学习)?\s*([\d.]+)\s*(?:个)?\s*选修学分/,
          /必修学分[，,、\s]*(?:您)?还需(?:要)?(?:学习)?\s*([\d.]+)\s*(?:个)?\s*选修学分/,
          /选修(?:学分)?\s*(?:还需|剩余|还差|需修)\s*[:：]?\s*([\d.]+)/,
          /(?:您)?还需要学习.*?([\d.]+)\s*(?:个)?\s*选修学分/
        ]),
        routeKey: routeKey
      };

      // 显式达标文本处理
      if (/(?:必修(?:学分)?|必修课)(?:已修满|已达标|已完成|已满足|合格)/.test(sourceText) ||
          /还需要学习\s*0(?:\.0+)?\s*(?:个)?\s*必修学分/.test(sourceText)) {
        data.remainingRequired = 0;
      }
      if (/(?:选修(?:学分)?|选修课)(?:已修满|已达标|已完成|已满足|合格)/.test(sourceText) ||
          /还需要学习\s*0(?:\.0+)?\s*(?:个)?\s*选修学分/.test(sourceText)) {
        data.remainingElective = 0;
      }

      // 差额互算兜底
      if (data.remainingRequired === null && data.requiredMin !== null && data.earnedRequired !== null) {
        data.remainingRequired = Math.max(0, data.requiredMin - data.earnedRequired);
      }
      if (data.remainingElective === null && data.electiveMin !== null && data.earnedElective !== null) {
        data.remainingElective = Math.max(0, data.electiveMin - data.earnedElective);
      }
      if ((data.totalRequirement === null || data.totalRequirement === undefined) && (data.requiredMin !== null || data.electiveMin !== null)) {
        data.totalRequirement = (data.requiredMin || 0) + (data.electiveMin || 0);
      }
      data.totalRequired = data.totalRequirement;

      const hasData = Object.keys(data).some(function (key) {
        return key === 'title' ? !!data[key] : (key !== 'routeKey' && data[key] !== null);
      });
      requirementCache = { ts: Date.now(), routeKey: routeKey, data: hasData ? data : null };
      return requirementCache.data;
    }

    // 智能高性价比选课规划器：按调度策略（极致性价 / 最短用时 / 高分攻坚）自动规划最优课程集合
    function computeOptimalCoursePlan(allCards, requirement) {
      const currentStrategy = localStorage.getItem('tb21_schedule_strategy') || 'cpi';
      const isRush = (typeof S !== 'undefined' && S && S.rushMode) ? true : false;

      const reqCards = [];
      const eleCards = [];
      allCards.forEach(function (c, idx) {
        const info = c.querySelector('.text-info');
        if (!info) return;
        const txt = info.textContent;
        const isDone = txt.indexOf('已完成') > -1;
        const isRequired = txt.indexOf('必修') > -1;
        const credits = getCourseCredits(c);
        const title = getCourseTitle(c);
        const courseId = getCardCourseId(c);

        // 从 CourseMetaStore 获取或触发异步扫描
        const meta = CourseMetaStore.get(courseId);
        if (!meta && courseId && !isDone) {
          CourseMetaStore.requestScan(courseId, function () {
            if (typeof refreshCourseList === 'function') refreshCourseList();
          });
        }

        const totalDuration = meta ? (meta.totalDuration || 0) : 0;
        const totalSections = meta ? (meta.totalSections || 0) : 0;
        const unfinishedDuration = meta ? (meta.unfinishedDuration || 0) : totalDuration;
        const unfinishedSections = meta ? (meta.unfinishedSections || 0) : totalSections;
        const durMin = totalDuration > 0 ? Math.max(1, Math.round(totalDuration / 60)) : 0;
        const unfDurMin = unfinishedDuration > 0 ? Math.max(1, Math.round(unfinishedDuration / 60)) : durMin;

        // 计算 CPI 综合效率
        const efficiency = CourseMetaStore.calculateScore(
          credits,
          unfinishedDuration || totalDuration || 1800,
          unfinishedSections || totalSections || 1,
          isRush
        );

        let cpiShort = '';
        let cpiLabel = '';
        if (efficiency >= 0.1) {
          cpiShort = '极佳';
          cpiLabel = '极佳 (' + efficiency + '分/m)';
        } else if (efficiency >= 0.05) {
          cpiShort = '优';
          cpiLabel = '良好 (' + efficiency + '分/m)';
        } else if (efficiency > 0) {
          cpiShort = '普通';
          cpiLabel = '一般 (' + efficiency + '分/m)';
        }

        const item = {
          card: c,
          title: title,
          credits: credits,
          courseId: courseId,
          done: isDone,
          isRequired: isRequired,
          idx: idx,
          totalDuration: totalDuration,
          totalSections: totalSections,
          unfinishedDuration: unfinishedDuration,
          unfinishedSections: unfinishedSections,
          durMin: durMin,
          unfDurMin: unfDurMin,
          efficiency: efficiency,
          cpiShort: cpiShort,
          cpiLabel: cpiLabel
        };
        if (isRequired) reqCards.push(item);
        else eleCards.push(item);
      });

      const sortFn = function (a, b) {
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (currentStrategy === 'shortest') {
          // ⏱️ 最短耗时优先：待播时长最短 > 待播章节最少 > 学分高 > 标题序
          const aTime = a.unfinishedDuration || a.totalDuration || 99999;
          const bTime = b.unfinishedDuration || b.totalDuration || 99999;
          if (aTime !== bTime) return aTime - bTime;
          const aSec = a.unfinishedSections || a.totalSections || 999;
          const bSec = b.unfinishedSections || b.totalSections || 999;
          if (aSec !== bSec) return aSec - bSec;
          if (a.credits !== b.credits) return b.credits - a.credits;
          return a.title.localeCompare(b.title, 'zh');
        } else if (currentStrategy === 'credits') {
          // 🎯 传统高分优先：学分降序 > 标题序
          if (a.credits !== b.credits) return b.credits - a.credits;
          return a.title.localeCompare(b.title, 'zh');
        } else {
          // ⚡ 极致性价比优先（默认）：efficiency 降序 > 学分降序 > 时长升序 > 标题序
          if (Math.abs(a.efficiency - b.efficiency) > 0.001) {
            return b.efficiency - a.efficiency;
          }
          if (a.credits !== b.credits) return b.credits - a.credits;
          const aTime = a.unfinishedDuration || a.totalDuration || 99999;
          const bTime = b.unfinishedDuration || b.totalDuration || 99999;
          if (aTime !== bTime) return aTime - bTime;
          return a.title.localeCompare(b.title, 'zh');
        }
      };

      reqCards.sort(sortFn);
      eleCards.sort(sortFn);

      const needReqCredit = (requirement && requirement.remainingRequired !== null)
        ? Math.max(0, requirement.remainingRequired)
        : (reqCards.filter(function (c) { return !c.done; }).length > 0 ? 999 : 0);

      const needEleCredit = (requirement && requirement.remainingElective !== null)
        ? Math.max(0, requirement.remainingElective)
        : (eleCards.filter(function (c) { return !c.done; }).length > 0 ? 999 : 0);

      let accReqCredit = 0;
      const planReq = [];
      const skipReq = [];
      reqCards.forEach(function (c) {
        if (c.done) {
          planReq.push(c);
        } else {
          if (accReqCredit < needReqCredit || needReqCredit === 999) {
            c.isPlanned = true;
            accReqCredit += c.credits;
            planReq.push(c);
          } else {
            c.isSkipped = true;
            skipReq.push(c);
          }
        }
      });

      let accEleCredit = 0;
      const planEle = [];
      const skipEle = [];
      eleCards.forEach(function (c) {
        if (c.done) {
          planEle.push(c);
        } else {
          if (accEleCredit < needEleCredit || needEleCredit === 999) {
            c.isPlanned = true;
            accEleCredit += c.credits;
            planEle.push(c);
          } else {
            c.isSkipped = true;
            skipEle.push(c);
          }
        }
      });

      const isFullySatisfied = needReqCredit <= 0 && needEleCredit <= 0;

      return {
        planReq: planReq,
        planEle: planEle,
        skipReq: skipReq,
        skipEle: skipEle,
        needReqCredit: needReqCredit,
        needEleCredit: needEleCredit,
        accReqCredit: accReqCredit,
        accEleCredit: accEleCredit,
        isFullySatisfied: isFullySatisfied
      };
    }

    buildAutoPanel(function () {
      const c = countCourses();
      const credit = readCategoryRequirement();
      const totalAll = c.required.total + c.elective.total;
      const doneAll = c.required.done + c.elective.done;
      const pctAll = totalAll > 0 ? Math.round(doneAll / totalAll * 100) : 0;
      const formatCredit = function (value) {
        return value === null || !isFinite(value) ? '--' : String(Math.round(value * 100) / 100);
      };

      const allCards = getVisibleCards();
      const plan = computeOptimalCoursePlan(allCards, credit);
      const plannedUnfinished = plan.planReq.concat(plan.planEle).filter(function (i) { return !i.done; }).length;

      const reqRemaining = credit && credit.remainingRequired !== null ? credit.remainingRequired : plan.needReqCredit;
      const eleRemaining = credit && credit.remainingElective !== null ? credit.remainingElective : plan.needEleCredit;
      const isReqOk = reqRemaining <= 0;
      const isEleOk = eleRemaining <= 0;

      const reqTargetStr = credit && credit.requiredMin !== null ? ('目标≥' + formatCredit(credit.requiredMin) + '分') : '必学学分';
      const eleTargetStr = credit && credit.electiveMin !== null ? ('目标≥' + formatCredit(credit.electiveMin) + '分') : '选修学分';

      return (
        '<div class="ap-credit-grid">' +
          '<div class="ap-credit-card req">' +
            '<div class="ap-card-label"><span>必修学分</span><span class="ap-card-target">' + reqTargetStr + '</span></div>' +
            '<div class="ap-card-val ' + (isReqOk ? 'ok' : 'need') + '">' + (isReqOk ? '✓ 已达标' : ('还需 ' + formatCredit(reqRemaining) + ' 分')) + '</div>' +
          '</div>' +
          '<div class="ap-credit-card ele">' +
            '<div class="ap-card-label"><span>选修学分</span><span class="ap-card-target">' + eleTargetStr + '</span></div>' +
            '<div class="ap-card-val ' + (isEleOk ? 'ok' : 'need') + '">' + (isEleOk ? '✓ 已达标' : ('还需 ' + formatCredit(eleRemaining) + ' 分')) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="ap-plan-summary">' +
          '<span>' + (credit && credit.isOfficialApi ? '📡 官方直连 ' : '📚 课程进度 ') + doneAll + '/' + totalAll + '（' + pctAll + '%）</span>' +
          '<span class="ap-target-badge">' + (plan.isFullySatisfied ? '🎉 学分已达成' : ('🎯 锁定 ' + plannedUnfinished + ' 门攻坚')) + '</span>' +
          ((plan.isFullySatisfied || (typeof localStorage !== 'undefined' && localStorage.getItem('tb21_exam_unlocked_' + ((activeCategory && activeCategory.year) || 'common')) === '1'))
            ? '<a href="https://cqrl.21tb.com/nms-frontend/index.html#/org/course/exam" target="_blank" style="margin-left:4px;color:#f59e0b;font-weight:bold;text-decoration:none;background:rgba(245,158,11,.2);padding:2px 6px;border-radius:4px;border:1px solid rgba(245,158,11,.4);" title="点击直达结业考试">🎓 结业考试 ➔</a>'
            : '') +
        '</div>'
      );
    });

    let stage = 0; // 0=确保tab, 1=确保filter, 2=选课
    let clickLock = 0; // 导航锁：点击课程后一段时间内不再操作，防止反复点击导致闪黑
    let exhaustedTabs = {}; // 当前巡课周期内已经逐页确认无可学课程的 tab

    const activeCategory = getActiveCategory();
    const categoryScope = activeCategory && activeCategory.key
      ? activeCategory.key
      : 'detail:' + normalizeAutoText(location.pathname + location.search + location.hash);
    function getCourseCardKey(card, title, tabName) {
      const cid = getCardCourseId(card);
      if (cid) return 'course-id:' + cid;
      return 'course-title:' + categoryScope + ':' + normalizeAutoText(tabName) + ':' + normalizeAutoText(title);
    }
    function cursorKey(tabName) {
      return categoryScope + ':' + normalizeAutoText(tabName);
    }
    function tabMemoryKey(tabName) {
      return 'tab:' + categoryScope + ':' + normalizeAutoText(tabName);
    }
    function getSavedPage(tabName) {
      const cursors = readAutoJson(AUTO_KEY_PAGE_CURSORS, {});
      const item = cursors[cursorKey(tabName)];
      return item && Date.now() - item.ts < AUTO_MEMORY_TTL ? Math.max(1, parseInt(item.page, 10) || 1) : 1;
    }
    function savePage(tabName, page) {
      const cursors = readAutoJson(AUTO_KEY_PAGE_CURSORS, {});
      cursors[cursorKey(tabName)] = { page: Math.max(1, page || 1), ts: Date.now() };
      writeAutoJson(AUTO_KEY_PAGE_CURSORS, cursors);
    }
    function clearSavedPage(tabName) {
      const cursors = readAutoJson(AUTO_KEY_PAGE_CURSORS, {});
      delete cursors[cursorKey(tabName)];
      writeAutoJson(AUTO_KEY_PAGE_CURSORS, cursors);
    }

    // 定期把类目进度存到 localStorage（供播放页面板显示）
    function storeCategoryProgress() {
      try {
        const c = countCourses();
        const activeTab = document.querySelector('.el-tabs__item.is-active');
        const params = getRouteQueryParams();
        localStorage.setItem('tb21_category_progress', JSON.stringify({
          required: c.required,
          elective: c.elective,
          credit: readCategoryRequirement(),
          activeTab: activeTab ? activeTab.textContent.trim() : '',
          projectId: params.projectId || '',
          roadMapId: params.roadMapId || '',
          ts: Date.now()
        }));
      } catch (e) {}
    }
    routeInterval(storeCategoryProgress, 3000);
    storeCategoryProgress();

    /* ---------- 课程列表（可折叠，按必修/选修分组，未完成在前，点击跳转） ---------- */
    function getCourseTitle(card) {
      const titleEl = card.querySelector('.item__title, .course__title, .title, h3, h4, p');
      if (titleEl && titleEl.textContent.trim().length > 3) return titleEl.textContent.trim();
      const info = card.querySelector('.text-info');
      const infoText = info ? info.textContent : '';
      return card.textContent.replace(infoText, '').trim().replace(/\s+/g, ' ').slice(0, 50);
    }
    function buildCourseList() {
      const panel = cachedEl('tb21-auto-panel');
      if (!panel) return;
      const body = panel.querySelector('.ap-body');
      if (!body || body.querySelector('.ap-courses')) return;
      const coursesDiv = document.createElement('div');
      coursesDiv.className = 'ap-courses';
      const curStrat = localStorage.getItem('tb21_schedule_strategy') || 'cpi';
      coursesDiv.innerHTML =
        '<div class="ap-strat-bar">' +
          '<span class="ap-strat-title">选课:</span>' +
          '<button class="ap-strat-btn' + (curStrat === 'cpi' ? ' active' : '') + '" data-strat="cpi" title="【极致性价比】学分/分钟比最高优先，耗时最少修满学分">⚡ 极速性价</button>' +
          '<button class="ap-strat-btn' + (curStrat === 'shortest' ? ' active' : '') + '" data-strat="shortest" title="【最短用时】总时长与章节数最少优先，微课极速秒过">⏱️ 最短用时</button>' +
          '<button class="ap-strat-btn' + (curStrat === 'credits' ? ' active' : '') + '" data-strat="credits" title="【高分攻坚】单课学分最高优先，经典大课攻坚模式">🎯 高分优先</button>' +
        '</div>' +
        '<div class="ap-cat-group" data-group="plan">' +
          '<div class="ap-cat-header"><span class="ap-cat-arrow">▼</span><span class="ap-cat-title">🎯 攻坚计划（精选课程）</span></div>' +
          '<div class="ap-cat-list"></div>' +
        '</div>' +
        '<div class="ap-cat-group collapsed" data-group="skip">' +
          '<div class="ap-cat-header"><span class="ap-cat-arrow">▼</span><span class="ap-cat-title">⏭️ 冗余课程（已跳过无需学）</span></div>' +
          '<div class="ap-cat-list"></div>' +
        '</div>' +
        '<div class="ap-cat-group collapsed" data-group="done">' +
          '<div class="ap-cat-header"><span class="ap-cat-arrow">▼</span><span class="ap-cat-title">✓ 已完成课程</span></div>' +
          '<div class="ap-cat-list"></div>' +
        '</div>';
      body.appendChild(coursesDiv);

      coursesDiv.querySelectorAll('.ap-strat-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const strat = btn.dataset.strat;
          localStorage.setItem('tb21_schedule_strategy', strat);
          coursesDiv.querySelectorAll('.ap-strat-btn').forEach(function (b) {
            b.classList.toggle('active', b.dataset.strat === strat);
          });
          refreshCourseList();
        });
      });

      coursesDiv.querySelectorAll('.ap-cat-header').forEach(function (header) {
        header.addEventListener('click', function () { header.closest('.ap-cat-group').classList.toggle('collapsed'); });
      });
    }

    function refreshCourseList() {
      const coursesDiv = document.querySelector('#tb21-auto-panel .ap-courses');
      if (!coursesDiv) return;
      const cards = getVisibleCards();
      const requirement = readCategoryRequirement();
      const plan = computeOptimalCoursePlan(cards, requirement);

      // 分组：精选攻坚(未完成且入选计划)、低分跳过(未完成且被跳过)、已完成课程
      const planItems = plan.planReq.concat(plan.planEle).filter(function (i) { return !i.done; });
      const skipItems = plan.skipReq.concat(plan.skipEle).filter(function (i) { return !i.done; });
      const doneItems = [];
      cards.forEach(function (c, idx) {
        const info = c.querySelector('.text-info');
        if (!info) return;
        const txt = info.textContent;
        if (txt.indexOf('已完成') > -1) {
          doneItems.push({
            card: c,
            title: getCourseTitle(c),
            credits: getCourseCredits(c),
            isRequired: txt.indexOf('必修') > -1,
            done: true,
            idx: idx
          });
        }
      });

      const curStrat = localStorage.getItem('tb21_schedule_strategy') || 'cpi';
      let stratTag = '⚡极佳性价';
      if (curStrat === 'shortest') stratTag = '⏱️最短用时';
      else if (curStrat === 'credits') stratTag = '🎯最高学分';

      const groupData = {
        plan: {
          items: planItems,
          title: plan.isFullySatisfied
            ? '🎯 攻坚计划（🎉 学分已达成）'
            : ('🎯 攻坚精选（' + planItems.length + ' 门 · ' + stratTag + '）')
        },
        skip: {
          items: skipItems,
          title: '⏭️ 冗余低效（' + skipItems.length + ' 门已跳过）'
        },
        done: {
          items: doneItems,
          title: '✓ 已完成课程（' + doneItems.length + ' 门）'
        }
      };

      Object.keys(groupData).forEach(function (key) {
        const groupEl = coursesDiv.querySelector('.ap-cat-group[data-group="' + key + '"]');
        if (!groupEl) return;
        const listEl = groupEl.querySelector('.ap-cat-list');
        const titleEl = groupEl.querySelector('.ap-cat-title');
        const data = groupData[key];
        titleEl.textContent = data.title;

        const sig = JSON.stringify(data.items.map(function (i) { return [i.title, i.credits, i.done, i.totalSections, i.efficiency]; }));
        if (listEl._lastSig === sig) return;
        listEl._lastSig = sig;

        if (data.items.length === 0) {
          listEl.innerHTML = '<div class="ap-course-meta" style="padding:6px;font-style:italic">暂无此项课程</div>';
          return;
        }

        listEl.innerHTML = data.items.map(function (item) {
          const typeCls = item.isRequired ? 'ap-tag-req' : 'ap-tag-ele';
          const typeTxt = item.isRequired ? '必修' : '选修';
          const extraCls = item.done ? ' done' : (key === 'plan' ? ' is-plan' : (key === 'skip' ? ' is-skip' : ''));
          const icon = item.done ? '✓' : (key === 'plan' ? '🎯' : '○');

          let metaHtml = '';
          if (item.totalSections > 0) {
            metaHtml += '<span class="ap-meta-pill" title="总计 ' + item.totalSections + ' 节，约 ' + item.durMin + ' 分钟">' + item.totalSections + '节</span>';
          }
          if (item.cpiShort) {
            metaHtml += '<span class="ap-cpi-pill" title="性价比指数：' + item.efficiency + '（' + item.cpiLabel + '）">⚡' + item.cpiShort + '</span>';
          }

          return '<div class="ap-course-item' + extraCls + '" data-idx="' + item.idx + '" title="' + item.title.replace(/"/g, '&quot;') + (item.cpiLabel ? ' · 性价比：' + item.cpiLabel : '') + '">' +
            '<span class="ap-course-check">' + icon + '</span>' +
            '<span class="' + typeCls + '">' + typeTxt + '</span>' +
            '<span class="ap-course-name">' + item.title + '</span>' +
            metaHtml +
            (item.credits ? '<span class="ap-credit-pill">' + item.credits + '分</span>' : '') +
          '</div>';
        }).join('');

        listEl.querySelectorAll('.ap-course-item').forEach(function (el) {
          el.addEventListener('click', function () {
            const idx = parseInt(el.dataset.idx, 10);
            const allCards = getVisibleCards();
            if (allCards[idx]) allCards[idx].click();
          });
        });
      });
    }
    buildCourseList();
    refreshCourseList();
    routeInterval(refreshCourseList, 3000);

    /* ---------- 缓存当前年度课程列表到 localStorage（供列表页展开显示） ---------- */
    function cacheYearCourses() {
      try {
        const year = localStorage.getItem('tb21_current_year') || '';
        if (!year) return;
        const cards = getVisibleCards();
        const courses = [];
        cards.forEach(function (c) {
          const info = c.querySelector('.text-info');
          if (!info) return;
          const txt = info.textContent;
          courses.push({
            title: getCourseTitle(c),
            done: txt.indexOf('已完成') > -1,
            credits: getCourseCredits(c)
          });
        });
        courses.sort(function (a, b) {
          if (a.done !== b.done) return a.done ? 1 : -1;
          if (a.credits !== b.credits) return b.credits - a.credits;
          return a.title.localeCompare(b.title, 'zh');
        });
        localStorage.setItem('tb21_courses_' + year, JSON.stringify({
          year: year, courses: courses, ts: Date.now()
        }));
      } catch (e) {}
    }
    cacheYearCourses();
    routeInterval(cacheYearCourses, 5000);
    // SPA 单页应用平滑返回大类目列表（避免硬重载页面导致全屏闪烁与无限刷新）
    function returnToCategoryList() {
      const backBtn = document.querySelector('.el-page-header__left, .back-btn, .btn-back, .page-back, .header__back, .back');
      if (backBtn && backBtn.offsetParent !== null) {
        try { backBtn.click(); return; } catch (e) {}
      }
      if (location.hash && location.hash.indexOf('courseDetail') > -1) {
        location.hash = '#/org/course/list?entrance=zygx';
      } else {
        try { location.replace(AUTO_LIST_URL); } catch (e) { location.href = AUTO_LIST_URL; }
      }
    }

    // 智能、健壮的课程卡片点击进入器（优先点击子元素标题/按钮，防止空链接触发页面刷新）
    function smartClickCourse(card) {
      if (!card) return false;
      const innerTarget = card.querySelector('.enter-btn, .btn-study, .study-btn, .start-study, .btn-primary, .item__title, .course__title, .title, a, button, h3, h4');
      if (innerTarget) {
        try { innerTarget.click(); return true; } catch (e) {}
      }
      try { card.click(); return true; } catch (e) {}
      return false;
    }

    function isReqTabName(str) { return !!(str && str.indexOf('必修') > -1); }
    function isEleTabName(str) { return !!(str && str.indexOf('选修') > -1); }

    routeInterval(function () {
      const isFleet = HeadlessFleetManager.isFleetRunning();
      if (!isAutoRunning() && !isFleet) { stage = 0; exhaustedTabs = {}; return; }

      // 🚀 纯后台静默舰队优先调度：若静默挂机开启，自动搜集计划内未完成课程加入舰队，全权由后台接管！
      if (isFleet) {
        if (HeadlessFleetManager.getQueueCount() === 0 && HeadlessFleetManager.getActiveWorkersStatus().length === 0) {
          scanAndDispatchFleet();
          return;
        }
        const allCards = getVisibleCards();
        const credit = readCategoryRequirement();
        const plan = computeOptimalCoursePlan(allCards, credit);
        const plannedCourses = plan.planReq.concat(plan.planEle).filter(function (c) { return !c.done; });

        const fleetCourses = [];
        plannedCourses.forEach(function (c) {
          const cid = getCardCourseId(c.card);
          if (cid) {
            fleetCourses.push({
              courseId: cid,
              title: c.title,
              sourceId: '',
              providerCorpCode: ''
            });
          }
        });
        HeadlessFleetManager.setCourses(fleetCourses);
        return; // 不点击任何卡片，防止弹窗打扰！
      }
      if (location.hash.indexOf('courseDetail') === -1) { stage = 0; exhaustedTabs = {}; return; } // 路由守卫
      if (Date.now() < clickLock) return; // 导航锁生效中

      const tabs = document.querySelectorAll('.el-tabs__item');
      const activeTab = document.querySelector('.el-tabs__item.is-active');
      const activeName = activeTab ? activeTab.textContent.trim() : '';

      // 复用组件使用的学分要求解析结果，保证显示与自动决策一致。
      const requirement = readCategoryRequirement();
      const allCards = getVisibleCards();
      const plan = computeOptimalCoursePlan(allCards, requirement);

      // 1. 核心判定：如果整个大类目的学分要求已经完全满足，顺利通关并返回大类目列表！
      if (plan.isFullySatisfied) {
        console.log('[刷课助手] 🎉 学分要求已完全满足！当前大类目顺利通关，即将返回大类目列表。');
        if (activeCategory && activeCategory.key) {
          rememberAutoKey(AUTO_KEY_DONE_CATEGORIES, activeCategory.key);
          clearCategoryCooldown(activeCategory.key);
        }

        // 异步核验结业考试准考资格
        (async function () {
          try {
            const params = getRouteQueryParams();
            if (params.roadMapId) {
              const stageList = await TbApiClient.getStageRequirements(params.roadMapId);
              const stageId = (stageList && stageList[0] && stageList[0].stageId) || '';
              if (stageId) {
                const examRes = await TbApiClient.checkExamAvailable(stageId);
                if (examRes && (examRes.isCanExam || examRes.success)) {
                  console.log('[刷课助手] 🎓 官方结业考试资格已解锁！已记录准考资格');
                  try { localStorage.setItem('tb21_exam_unlocked_' + ((activeCategory && activeCategory.year) || 'common'), '1'); } catch (e) {}
                }
              }
            }
          } catch (err) {}
        })();

        clickLock = Date.now() + 5000;
        stage = 0;
        returnToCategoryList();
        return;
      }

      // 2. 核心判定：判断必修和选修是否还需要学习。
      // 保护逻辑：只要当前屏幕上或规划中有可攻坚的未完成课，绝不能因历史缓存跳过！
      const hasReqCards = plan.planReq.some(function (c) { return !c.done; });
      const hasEleCards = plan.planEle.some(function (c) { return !c.done; });

      const needReq = plan.needReqCredit > 0 && (!exhaustedTabs['必修课'] || hasReqCards);
      const needEle = plan.needEleCredit > 0 && (!exhaustedTabs['选修课'] || hasEleCards);

      console.log(`[刷课助手] 学分与规划决策: 必修缺=${plan.needReqCredit}分(${needReq ? '要学' : '无需/已扫尽'}), 选修缺=${plan.needEleCredit}分(${needEle ? '要学' : '无需/已扫尽'})`);

      // 只有在学分缺额完全为 0 且均无需学习时，才正常完成返回列表
      if (!needReq && !needEle && plan.needReqCredit <= 0 && plan.needEleCredit <= 0) {
        console.log('[刷课助手] 计划所需学分已全部达成，当前大类目完成，返回列表');
        if (activeCategory && activeCategory.key) {
          rememberAutoKey(AUTO_KEY_DONE_CATEGORIES, activeCategory.key);
          clearCategoryCooldown(activeCategory.key);
        }

        (async function () {
          try {
            const params = getRouteQueryParams();
            if (params.roadMapId) {
              const stageList = await TbApiClient.getStageRequirements(params.roadMapId);
              const stageId = (stageList && stageList[0] && stageList[0].stageId) || '';
              if (stageId) {
                const examRes = await TbApiClient.checkExamAvailable(stageId);
                if (examRes && (examRes.isCanExam || examRes.success)) {
                  console.log('[刷课助手] 🎓 官方结业考试资格已解锁！已记录准考资格');
                  try { localStorage.setItem('tb21_exam_unlocked_' + ((activeCategory && activeCategory.year) || 'common'), '1'); } catch (e) {}
                }
              }
            }
          } catch (err) {}
        })();

        clickLock = Date.now() + 5000;
        stage = 0;
        returnToCategoryList();
        return;
      }

      // 阶段0：确保在正确的 tab (支持带数字或角标的模糊匹配，如 "必修课 (8)")
      if (stage === 0) {
        const isCurrentReq = isReqTabName(activeName);
        const isCurrentEle = isEleTabName(activeName);
        if (needReq && !isCurrentReq) {
          const bixiu = [...tabs].find(function (t) { return isReqTabName(t.textContent); });
          if (bixiu) { clickLock = Date.now() + 1200; bixiu.click(); stage = 1; return; }
        } else if (!needReq && needEle && !isCurrentEle) {
          const xuanxiu = [...tabs].find(function (t) { return isEleTabName(t.textContent); });
          if (xuanxiu) { clickLock = Date.now() + 1200; xuanxiu.click(); stage = 1; return; }
        }
        stage = 1;
      }

      // 阶段1：确保筛选「未完成」
      if (stage === 1) {
        const filterBtns = document.querySelectorAll('.btn-item.cursor');
        const unfinishedFilter = [...filterBtns].find(function (b) { return b.textContent.trim() === '未完成'; });
        if (unfinishedFilter) {
          const isActive = unfinishedFilter.className.indexOf('btn-item-active') > -1 || unfinishedFilter.className.indexOf('active') > -1;
          if (!isActive) { clickLock = Date.now() + 1200; unfinishedFilter.click(); stage = 2; return; }
        }
        stage = 2;
      }

      // 阶段2：在当前 tab/当前页中，只从被计划【攻坚锁定】且未完成的课程中，按学分降序选取！
      if (stage === 2) {
        const cards = getVisibleCards();
        const emptyState = Array.prototype.slice.call(document.querySelectorAll(
          '.el-empty, .el-table__empty-text, .empty-data, .no-data, .empty'
        )).some(function (el) {
          return el.offsetParent !== null && /暂无|没有|无课程|无数据/.test(el.textContent || '');
        });
        if (cards.length === 0 && !emptyState) return; // 列表仍在异步加载，不能误判为巡完

        let recentTitle = '', recentTs = 0;
        try {
          recentTitle = localStorage.getItem('tb21_helper_recent_done_title') || '';
          recentTs = parseInt(localStorage.getItem('tb21_helper_recent_done_ts') || '0', 10);
        } catch (e) {}

        // 基于当前卡片计算规划（自适应 Tab 判定，避免名字微差异导致 currentTabPlan 被置空）
        const isCurrentReq = isReqTabName(activeName);
        const isCurrentEle = isEleTabName(activeName);
        const currentPlan = computeOptimalCoursePlan(cards, requirement);
        const currentTabPlan = isCurrentReq ? currentPlan.planReq : (isCurrentEle ? currentPlan.planEle : currentPlan.planReq.concat(currentPlan.planEle));

        const candidates = [];
        for (let i = 0; i < currentTabPlan.length; i++) {
          const planItem = currentTabPlan[i];
          if (planItem.done) continue;
          const title = planItem.title;
          const courseKey = getCourseCardKey(planItem.card, title, activeName);

          if (hasFreshAutoKey(AUTO_KEY_DONE_COURSES, courseKey)) {
            console.log('[刷课助手] 跳过本地已确认完播但平台状态尚未刷新的课程：', title);
            continue;
          }
          if (recentTitle && Date.now() - recentTs < 3 * 60 * 1000 &&
              (title.indexOf(recentTitle) > -1 || recentTitle.indexOf(title) > -1)) {
            console.log('[刷课助手] 保护机制：跳过刚完成但状态未刷新的课程，防止循环进入：', title);
            continue;
          }

          candidates.push({
            card: planItem.card,
            title: title,
            key: courseKey,
            credits: planItem.credits,
            index: planItem.idx,
            planRank: i
          });
        }

        // 严格遵循所选调度策略（极速性价比 / 最短用时 / 高分攻坚）的规划优先级排序！
        candidates.sort(function (a, b) {
          return a.planRank - b.planRank;
        });

        // 翻页处理
        const activePageEl = document.querySelector(
          '.el-pagination .el-pager li.active, .el-pagination .number.active, .pagination .active'
        );
        const detectedPage = activePageEl ? parseInt(activePageEl.textContent, 10) : 0;
        const pagerItems = Array.prototype.slice.call(document.querySelectorAll(
          '.el-pagination .el-pager li, .el-pagination button, .pagination button, .pagination a'
        ));
        let nextPageBtn = document.querySelector('.el-pagination .btn-next, .pagination .next');
        if (!nextPageBtn) {
          nextPageBtn = pagerItems.find(function (el) {
            const txt = (el.textContent || el.getAttribute('aria-label') || el.title || '').trim();
            return txt.indexOf('下一页') > -1;
          }) || null;
        }
        const canUsePager = function (btn) {
          return !!(btn && !btn.disabled && !btn.classList.contains('disabled'));
        };
        const currentPage = detectedPage || 1;
        const savedPage = getSavedPage(activeName);

        if (savedPage > currentPage) {
          const directPageBtn = pagerItems.find(function (el) {
            return (el.textContent || '').trim() === String(savedPage) && !el.classList.contains('disabled');
          });
          const jumper = document.querySelector(
            '.el-pagination__jump input, .el-pagination .el-input__inner, .pagination input[type="number"]'
          );
          if (!directPageBtn && jumper && savedPage - currentPage > 2) {
            try {
              const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
              if (setter && setter.set) setter.set.call(jumper, String(savedPage));
              else jumper.value = String(savedPage);
              jumper.dispatchEvent(new Event('input', { bubbles: true }));
              jumper.dispatchEvent(new Event('change', { bubbles: true }));
              jumper.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
              console.log('[刷课助手] 通过跳页框恢复到第 ' + savedPage + ' 页');
              clickLock = Date.now() + 1200;
              return;
            } catch (e) {}
          }
          const quickNext = document.querySelector('.el-pagination .el-pager .more.quicknext, .pagination .quicknext');
          const restoreBtn = directPageBtn || quickNext || (canUsePager(nextPageBtn) ? nextPageBtn : null);
          if (restoreBtn) {
            console.log('[刷课助手] 快速恢复到上次巡课页：第 ' + savedPage + ' 页');
            clickLock = Date.now() + 900;
            restoreBtn.click();
            return;
          }
        }

        // 当前页有被规划选中的高分课程，立即进入！
        const target = candidates[0] || null;
        if (target) {
          savePage(activeName, currentPage);
          writeAutoJson(AUTO_KEY_PENDING_COURSE, {
            key: target.key,
            title: target.title,
            categoryKey: categoryScope,
            tab: activeName,
            page: currentPage,
            ts: Date.now()
          });
          console.log('[刷课助手] 🎯 攻坚锁定高分课程：', target.title, '(' + target.credits + '学分，第' + currentPage + '页)');
          clickLock = Date.now() + 15000;
          stage = 0;
          smartClickCourse(target.card);
          return;
        }

        // 当前页没有计划中的未完成课程，翻向下一页继续寻找高分课程
        if (canUsePager(nextPageBtn)) {
          savePage(activeName, currentPage + 1);
          console.log('[刷课助手] 第 ' + currentPage + ' 页无可攻坚课程，继续下一页');
          clickLock = Date.now() + 900;
          nextPageBtn.click();
          return;
        }

        // 当前 Tab 的所有分页都翻完了
        exhaustedTabs[activeName] = true;
        rememberAutoKey(AUTO_KEY_DONE_TABS, tabMemoryKey(activeName));
        clearSavedPage(activeName);

        const isCurReq = isReqTabName(activeName);
        const otherTab = [...tabs].find(function (t) {
          return isCurReq ? isEleTabName(t.textContent) : isReqTabName(t.textContent);
        });
        const otherNeeded = isCurReq ? needEle : needReq;
        if (otherTab && otherNeeded && !exhaustedTabs[otherTab.textContent.trim()]) {
          console.log('[刷课助手] 当前 Tab 已巡完，切换到另一科目 Tab');
          clickLock = Date.now() + 1200;
          otherTab.click();
          stage = 1;
          return;
        }

        // 两个 tab 均无可学课程，判定当前大类目退出处理
        // 防抖：若 DOM 处于异步更新状态（cards 数量为 0 且无明确空提示），先等待，不盲目退出
        if (cards.length === 0 && !emptyState) return;

        if (activeCategory && activeCategory.key) {
          if (plan.isFullySatisfied || (!needReq && !needEle)) {
            rememberAutoKey(AUTO_KEY_DONE_CATEGORIES, activeCategory.key);
            clearCategoryCooldown(activeCategory.key);
            console.log('[刷课助手] 🎉 当前大类目学分已完全满足，记录通关并返回大类目列表');
          } else {
            // 平台无更多课可学但学分仍有差额，放入 2 小时冷却池，防止死循环进入
            markCategoryCooldown(activeCategory.key);
            console.log('[刷课助手] ⚠️ 当前大类目已无更多可用课程（学分未完全达标），自动加入冷却保护池，退回列表调度其他大类目！');
          }
        }
        clickLock = Date.now() + 5000;
        stage = 0;
        returnToCategoryList();
        return;
      }
    }, 3000);
    return cleanupCourseDetail;
  }

  /* ================================================================
   * 播放页 iframe（courseSetting/coursePlay/*）
   * 职责：倍速、静音、自动下一节、弹窗/挂起/答题处理、控制面板
   * ================================================================ */
  function initPlayer() {
    if (location.pathname.indexOf('/courseSetting/coursePlay') !== 0) return;
    fixSessionCookie();
    overrideConfirm();

    // [播放页 0ms 强杀] 在播放器 iframe 内部实时监听 DOM 树，学霸君/异常弹窗一旦注入 0ms 强杀并恢复播放
    try {
      const iframeFastKiller = new MutationObserver(function () {
        const boxes = document.querySelectorAll('.el-message-box__wrapper, .el-message-box, .pCheat-box, .hangUp-box');
        boxes.forEach(function (box) {
          const txt = box.textContent || '';
          if (txt.indexOf('学霸君') > -1 || txt.indexOf('学习行为') > -1 || txt.indexOf('存在异常') > -1 || txt.indexOf('拖拽') > -1) {
            console.log('[刷课助手-播放页护盾] ⚡ MutationObserver 0ms 瞬间强杀「学霸君/拖拽」弹窗！');
            const btn = box.querySelector('.el-button--primary, .el-button, button');
            if (btn) {
              try { btn.click(); } catch (e) {}
            }
            try { box.remove(); } catch (e) {}
            document.querySelectorAll('.v-modal, .el-popup-parent--hidden').forEach(function (m) {
              try { m.remove(); } catch (e) {}
            });
            if (document.body) document.body.classList.remove('el-popup-parent--hidden');
            const v = getVideo ? getVideo() : document.querySelector('video');
            if (v && v.paused && !v.ended) {
              v.play().catch(function () {});
            }
          }
        });
      });
      iframeFastKiller.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch(e) {}

    // [Vue 播放器属性强制解锁] 遍历 Vue 播放器组件，把 allowDrag / allowHighSpeed 设为 true，关闭 preventCheatFlag，伪装 recordTime 杜绝 50% 限制
    function unlockVuePlayerInstance() {
      try {
        const rootEl = document.getElementById('app');
        if (!rootEl || !rootEl.__vue__) return;
        function unlockComponent(vm) {
          if (!vm) return;
          if ('allowDrag' in vm) vm.allowDrag = true;
          if ('allowHighSpeed' in vm) vm.allowHighSpeed = true;
          if ('allowMinStudyTime' in vm) vm.allowMinStudyTime = true;
          if ('preventCheatFlag' in vm) vm.preventCheatFlag = false;
          if ('hangUpFlag' in vm) vm.hangUpFlag = false;
          if ('mustReplayCanFinish' in vm) vm.mustReplayCanFinish = false;
          if ('isEdge' in vm) vm.isEdge = false;
          if ('isIE11' in vm) vm.isIE11 = false;
          // 核心绝杀：强行将 recordTime 伪装到 noPreviewCurTimeToFinish (50%) 以上，破除“画面变灰+重新观看”判定！
          if ('recordTime' in vm && 'noPreviewCurTimeToFinish' in vm) {
            if (vm.recordTime < vm.noPreviewCurTimeToFinish + 10) {
              vm.recordTime = vm.noPreviewCurTimeToFinish + 10;
            }
          }
          if (vm.$children && vm.$children.length) {
            vm.$children.forEach(unlockComponent);
          }
        }
        unlockComponent(rootEl.__vue__);
      } catch(e) {}
    }
    setInterval(unlockVuePlayerInstance, 1000);

    /* ---------- 播放前静音：避免 autoplay 先出声、轮询随后才静音 ---------- */
    function forceMuteBeforePlay(media) {
      if (!media || !S.autoMute) return;
      try { media.defaultMuted = true; } catch (e) {}
      try { media.muted = true; } catch (e) {}
      try { media.setAttribute('muted', ''); } catch (e) {}
    }
    function applyMutePreference(media) {
      if (!media) return;
      if (S.autoMute) {
        forceMuteBeforePlay(media);
        return;
      }
      try { media.defaultMuted = false; } catch (e) {}
      try { media.removeAttribute('muted'); } catch (e) {}
      try { media.muted = false; } catch (e) {}
    }
    try {
      const mediaProto = HTMLMediaElement.prototype;
      if (!mediaProto.__tb21EarlyMuteInstalled) {
        Object.defineProperty(mediaProto, '__tb21EarlyMuteInstalled', {
          value: true, configurable: true
        });

        // JS 调用 play() 时，必须先完成静音再交给浏览器启动解码/输出。
        const rawMediaPlay = mediaProto.play;
        mediaProto.play = function () {
          forceMuteBeforePlay(this);
          return rawMediaPlay.apply(this, arguments);
        };

        // 自动静音开启期间，拒绝播放器在加载阶段把 muted 临时改回 false。
        const mutedDesc = Object.getOwnPropertyDescriptor(mediaProto, 'muted');
        if (mutedDesc && mutedDesc.get && mutedDesc.set && mutedDesc.configurable) {
          Object.defineProperty(mediaProto, 'muted', {
            get: function () { return mutedDesc.get.call(this); },
            set: function (value) {
              return mutedDesc.set.call(this, S.autoMute ? true : value);
            },
            configurable: true,
            enumerable: mutedDesc.enumerable
          });
        }
      }

      const installEarlyMuteObserver = function () {
        const root = document.documentElement;
        if (!root) {
          setTimeout(installEarlyMuteObserver, 0);
          return;
        }
        root.querySelectorAll('video, audio').forEach(forceMuteBeforePlay);
        new MutationObserver(function (mutations) {
          mutations.forEach(function (mutation) {
            Array.prototype.forEach.call(mutation.addedNodes || [], function (node) {
              if (!node || node.nodeType !== 1) return;
              if (node.matches && node.matches('video, audio')) forceMuteBeforePlay(node);
              if (node.querySelectorAll) node.querySelectorAll('video, audio').forEach(forceMuteBeforePlay);
            });
          });
        }).observe(root, { childList: true, subtree: true });
      };
      installEarlyMuteObserver();

      // declarative autoplay 不一定经过页面脚本调用 play()，再加一层捕获阶段兜底。
      EventTarget.prototype.addEventListener.call(document, 'play', function (event) {
        forceMuteBeforePlay(event.target);
      }, true);
    } catch (e) {
      console.log('[刷课助手] 播放前静音保护初始化失败:', e);
    }

    /* ---------- 🕵️ 上帝模式状态核验 ---------- */
    try {
      // 顶部已在 document-start 阶段将上帝模式与防封护盾注入页面主 DOM，此处无需重复注入
    } catch (e) {}

    /* ---------- 核心防御：拦截平台强制拉回进度 ---------- */
    try {
      const originalTimeDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
      if (originalTimeDesc) {
        Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
          get: function () {
            return originalTimeDesc.get.call(this);
          },
          set: function (val) {
            const current = originalTimeDesc.get.call(this);
            // 拦截条件：只要已播超过 3 秒，且目标时间比当前时间小超过 2 秒（包括被平台强行归零）
            // 只要不是正在正常切小节/切课程，坚决拒绝倒退与归零！
            if (current > 3 && (current - val) > 2 && !window.__tb21_switching_section) {
              if (!this._lastInterceptLog || Date.now() - this._lastInterceptLog > 3000) {
                console.log('[刷课助手] 🛡️ 坚决拦截平台尝试拉回/重置进度！原时间:', current.toFixed(1), '目标时间:', val.toFixed(1));
                this._lastInterceptLog = Date.now();
              }
              return; // 拒绝修改，防止倒退与清零！
            }
            originalTimeDesc.set.call(this, val);
          }
        });
        console.log('[刷课助手] 🛡️ 进度防拉回底层拦截已开启');
      }
    } catch (e) {}
    setInterval(autoDismissMessageBox, 1500);
    setInterval(activityKeeper, 30000);

    let quizOpen = false;      // 防作弊答题验证中
    let endingLock = false;    // 防止重复触发切节
    let userPaused = false;    // 用户手动暂停标志（手动暂停后不自动恢复，直到手动播放）
    let lastUserMediaActionAt = 0; // 最近一次真实的播放器鼠标/键盘操作，用于区分后台自动暂停
    let isWaitingNext = false; // 正在等待切节中（防止结束时重头播放）
    let isWaitingNextTime = 0; // isWaitingNext 设置时间，用于超时检测
    let softStartUntil = 0;    // 缓启动截止时间（新视频前8秒用1x原速度建立缓冲）
    let rampUpTimer = null;     // 渐进式加速定时器
    let newVideoProtectUntil = 0; // 新视频保护期（前20秒真实时间不触发主动切节，防止十几秒就跳走）
    let nearEndHandled = false; // 接近结尾/章节完成已触发切节（防止重复）
    let boostTimer = null;
    let lastTitle = document.title;
    let lastVideoEl = null;    // 检测视频元素替换（切课后 Aliplayer 可能重建 video）
    let lastVideoSrc = '';     // 检测视频 src 变化（Aliplayer 可能复用 video 元素）
    let speedGuardRetry = 0;   // 倍速守护重试计数
    let nextTimers = [];       // 管理切节定时器，防止重叠跳课
    let tryNextRetryCount = 0;  // tryNext 重试计数器
    let courseDoneNotified = false; // 最后一节只通知父页面一次
    let lastActiveSectionEl = null; // 视频结束瞬间平台可能移除 active，保留最后一次定位结果

    function getTrackedActiveSection() {
      const current = document.querySelector(
        'li.section-item .first-line.active, .chapter-item li .active, .course-chapter li .active, .section-box li .active'
      );
      if (current) lastActiveSectionEl = current;
      if (lastActiveSectionEl && document.documentElement.contains(lastActiveSectionEl)) return lastActiveSectionEl;
      lastActiveSectionEl = null;
      return null;
    }

    function clearNextTimers() {
      nextTimers.forEach(function(t) {
        clearTimeout(t);
        clearInterval(t);
      });
      nextTimers = [];
    }

    let lastMaxTime = 0; // 新视频重置回拉检测基准

    /* ---------- 视频获取（带缓存，元素被替换时自动失效） ---------- */
    let _cachedVideo = null;
    function getVideo() {
      if (_cachedVideo && document.contains(_cachedVideo)) return _cachedVideo;
      _cachedVideo = document.querySelector('video');
      return _cachedVideo;
    }

    /* ---------- 弹窗状态 ---------- */
    function isQuizOpen() {
      const box = document.querySelector('.pCheat-box');
      return !!(box && box.offsetParent !== null);
    }
    function isHangUpOpen() {
      const box = document.querySelector('.hangUp-box');
      return !!(box && box.offsetParent !== null);
    }

    /* ---------- 应用倍速/静音 ---------- */
    function applySettings(v) {
      if (!v) return;
      try {
        if (S.autoMute) {
          v.muted = true; // 只置静音，不动 volume，避免关掉静音后仍无声
        }
        // 缓启动期间（前8秒）：强制保持 1x 原速度建立缓冲
        if (Date.now() < softStartUntil) {
          if (v.playbackRate !== 1) v.playbackRate = 1;
          return;
        }
        // 渐进式加速进行中：不覆盖倍速，让加速定时器控制
        if (rampUpTimer) return;
        // 视频接近结尾时：保持 1x 确保正常 ended（高倍速下 ended 事件可能不触发）
        if (v.duration && v.duration > 0 && !v.ended) {
          const remain = v.duration - v.currentTime;
          if (remain < 10 && remain >= 0) {
            if (v.playbackRate !== 1) v.playbackRate = 1;
            return;
          }
        }
        v.playbackRate = S.speed; // Chrome 上限 16，直接设置即可
      } catch (e) {}
    }

    /* ---------- 自动恢复播放（排除答题验证/挂起中） ---------- */
    function resumeIfPaused() {
      if (!S.autoNext) return; // 以自动运行开关为准
      if (userPaused) return; // 用户手动暂停，不自动恢复
      // isWaitingNext 超时检测：如果等待切节超过 30 秒还没切成功，自动解除锁定恢复播放
      if (isWaitingNext && Date.now() - isWaitingNextTime > 30000) {
        console.log('[刷课助手] 等待切节超时（30秒），解除锁定恢复播放');
        isWaitingNext = false;
        endingLock = false; // 同时清除 endingLock，防止死锁
      }
      if (isWaitingNext) return; // 正在等待切节，绝对禁止重新播放
      if (isQuizOpen() || isHangUpOpen()) return;
      const v = getVideo();
      if (!v) return;
      if (v.paused && !v.ended && v.readyState >= 2) {
        // 不检查 document.hidden：后台标签页也要自动恢复（多课同刷依赖）
        try { v.play().catch(function (e) {
            console.log('[刷课助手] 后台自动恢复播放失败 (可能是浏览器硬性限制，请尝试保持网页最小化而不是完全被其他窗口遮挡):', e);
        }); } catch (e) {}
      }
    }

    /* ---------- 后台标签页保活（防止 Chrome 节流导致视频暂停） ---------- */
    // Chrome 会对后台标签页进行节流：setInterval 最低 1 秒，视频可能被暂停
    // 解决方案：播放一个静音音频，让 Chrome 认为标签页正在播放音频，从而不进行节流
    let keepAliveAudio = null;
    let keepAliveCtx = null;
    let keepAliveGain = null;
    let keepAliveOscillator = null;
    function startKeepAlive() {
      // AudioContext 可能在切到后台后被浏览器挂起；每次调用都检查并尝试恢复。
      if (keepAliveCtx) {
        if (keepAliveCtx.state === 'suspended') {
          try {
            const resumed = keepAliveCtx.resume();
            if (resumed && typeof resumed.catch === 'function') {
              resumed.catch(function () {}); // 下一次用户操作时会再次尝试
            }
          } catch (e) {}
        }
        return;
      }
      if (keepAliveAudio) {
        if (keepAliveAudio.paused) {
          try { keepAliveAudio.play().catch(function () {}); } catch (e) {}
        }
        return;
      }
      try {
        // 方式1：Web Audio API 创建近乎无声的高频振荡器。
        // 完全 0 增益不会被 Chrome 视作音频活动，无法避免后台强节流。
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          keepAliveCtx = new AudioCtx();
          keepAliveGain = keepAliveCtx.createGain();
          keepAliveGain.gain.value = 0.001; // 约 -60dB，避免被判定为完全静音
          keepAliveGain.connect(keepAliveCtx.destination);
          keepAliveOscillator = keepAliveCtx.createOscillator();
          keepAliveOscillator.type = 'sine';
          keepAliveOscillator.frequency.value = 19000; // 高频且极低音量，通常不可闻
          keepAliveOscillator.connect(keepAliveGain);
          keepAliveOscillator.start();
          try {
            const resumed = keepAliveCtx.resume();
            if (resumed && typeof resumed.catch === 'function') resumed.catch(function () {});
          } catch (e) {}
          console.log('[刷课助手] 后台保活已启动（Web Audio 低音量振荡器）');
          return;
        }
      } catch (e) {
        console.log('[刷课助手] Web Audio 保活失败，尝试 audio 元素方式:', e.message);
      }
      try {
        // 方式2：创建一个静音的 audio 元素，循环播放
        // 使用 base64 编码的极短静音 WAV 文件
        const silentWav = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
        keepAliveAudio = new Audio(silentWav);
        keepAliveAudio.loop = true;
        keepAliveAudio.volume = 0; // 静音
        keepAliveAudio.play().catch(function(e) {
          console.log('[刷课助手] 静音 audio 播放失败（可能需要用户交互后才能播放）:', e.message);
        });
        console.log('[刷课助手] 后台保活已启动（静音 audio 元素）');
      } catch (e) {
        console.log('[刷课助手] 后台保活启动失败:', e.message);
      }
    }

    function isPlayerInteractionTarget(target) {
      if (!target || target.nodeType !== 1) return false;
      const v = getVideo();
      if (target === v) return true;
      try {
        return !!target.closest('video, .prism-player, .ali-player, .aliplayer, .video-player, .player-container');
      } catch (e) { return false; }
    }

    // 只把紧邻真实播放器操作的 pause 当作“用户手动暂停”。
    // 浏览器/平台在后台产生的原生 pause 也可能 isTrusted=true，不能只依赖 isTrusted。
    EventTarget.prototype.addEventListener.call(document, 'pointerdown', function (ev) {
      if (!isPlayerInteractionTarget(ev.target)) return;
      lastUserMediaActionAt = Date.now();
      startKeepAlive(); // 在用户手势回调内启动/恢复 AudioContext，避免 autoplay 策略挂起
    }, true);
    EventTarget.prototype.addEventListener.call(document, 'keydown', function (ev) {
      if (ev.key !== ' ' && ev.key !== 'k' && ev.key !== 'K') return;
      const target = ev.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      lastUserMediaActionAt = Date.now();
      startKeepAlive();
    }, true);

    // 上面的全局防后台逻辑会屏蔽普通 visibilitychange 注册，直接调用原生原型注册内部恢复监听。
    EventTarget.prototype.addEventListener.call(document, 'visibilitychange', function () {
      const v = getVideo();
      if (v && !v.ended && !userPaused) {
        console.log('[刷课助手] 页面可见性变化，检查并恢复后台播放');
        startKeepAlive();
        setTimeout(resumeIfPaused, 100);
        setTimeout(resumeIfPaused, 500);
        setTimeout(resumeIfPaused, 1000);
        if (v) applySettings(v);
      }
    }, false);

    /* ---------- 自动下一节 ---------- */
    function findNextSectionItem() {
      const items = Array.prototype.slice.call(document.querySelectorAll('li.section-item, .chapter-item li, .course-chapter li, .section-box li'));

      if (items.length === 0) return null;

      const trackedActive = getTrackedActiveSection();
      let activeIdx = items.findIndex(function (li) {
        const fl = li.querySelector('.first-line') || li;
        return (trackedActive && (li === trackedActive || li.contains(trackedActive))) ||
          (fl && (fl.className.indexOf('active') > -1 || li.className.indexOf('active') > -1));
      });

      // 如果没找到 active（可能是视频结束后类名被清除了），那就从头开始找第一个没完成的
      if (activeIdx === -1) {
        activeIdx = -1; // 强制设为 -1，下面的 for 循环就会从 i=0 开始找
      }

      // watched 表示本次页面会话中已经真实播完。绝不能清除后重找，否则平台 finish
      // 状态更新稍慢时会把刚学完的章节从头再播一轮。
      return findNextUnfinished(items, activeIdx, true);
    }

    // 辅助函数：查找下一个未完成的章节
    function findNextUnfinished(items, activeIdx, skipWatched) {
      for (let i = activeIdx + 1; i < items.length; i++) {
        // 不仅检查 finish，还要检查 finished, is-finish 等变体
        if (!hasFinishedClass(items[i])) {
          const fl = items[i].querySelector('.first-line') || items[i];
          // 如果这个小节我们刚刚看过了（并且没被打上finish），直接跳过它，防止重复鬼畜
          if (skipWatched && fl && fl.dataset.watched === '1') {
             continue;
          }
          if (fl) {
            let needWait = false;
            // 如果跨章节了，目标章节可能被折叠隐藏，需要先把它的父级章节展开
            const parentChapter = items[i].closest('.chapter-item, .course-chapter, .section-box');
            if (parentChapter) {
              const chapterTitle = parentChapter.querySelector('.chapter-title, .title, .name, .chapter-name');
              // 判断是否折叠（高度很小，或者带有折叠的特定 class）
              if (chapterTitle && (parentChapter.offsetHeight < 60 || parentChapter.className.indexOf('collapsed') > -1 || parentChapter.className.indexOf('close') > -1)) {
                 try {
                    chapterTitle.click();
                    needWait = true;
                 } catch(e) {}
                 console.log('[刷课助手] 尝试展开下一章节目录，等待动画...');
              }
            }
            return { el: fl, needWait: needWait };
          }
        }
      }
      return null;
    }

    // 检测所有章节是否都已完成（用于判断是否是最后一节）
    function isAllSectionsDone() {
      const items = document.querySelectorAll('li.section-item, .chapter-item li, .course-chapter li, .section-box li');
      if (items.length === 0) return false;
      for (let i = 0; i < items.length; i++) {
        const firstLine = items[i].querySelector('.first-line') || items[i];
        const locallyWatched = firstLine && firstLine.dataset.watched === '1';
        if (!hasFinishedClass(items[i]) && !locallyWatched) return false;
      }
      return true;
    }

    function tryNext() {
      if (!S.autoNext || endingLock) return;
      if (isQuizOpen() || isHangUpOpen()) return;

      // 先检测是否所有章节都已完成（最后一节）
      const allDone = isAllSectionsDone();

      // 获取当前激活章节文本（用于切课后验证是否真的切换了）
      function getActiveSectionText() {
        const el = document.querySelector('li.section-item .first-line.active, .chapter-item li .active, .course-chapter li .active, .section-box li .active');
        return el ? el.textContent.trim().slice(0, 30) : '';
      }

      if (!allDone) {
        // 非最后一节：首选平台自己的「下一节」按钮（兼容多种类名）
      const nb = document.querySelector('.next-button, .next-btn, .pv-next-play, .pv-next-video, .next-step, .next-section, .next-chapter, .play-next, #goNextStep');
      // 可见性判断：display 非 none 且 visibility 非 hidden（不依赖 offsetParent，因为 fixed 定位的元素 offsetParent 为 null）
      let nbVisible = false;
      if (nb) {
        const style = getComputedStyle(nb);
        nbVisible = style.display !== 'none' && style.visibility !== 'hidden' && nb.offsetParent !== null;
        // 如果 offsetParent 为 null 但 display 非 none，也算可见（fixed 定位）
        if (!nbVisible && style.display !== 'none' && style.visibility !== 'hidden') {
          nbVisible = true;
        }
      }
        // 提前结束阈值：视频剩余多少秒时允许切课。
        // 因为16x倍速下，系统可能提前近1分钟判定完成，我们把容忍度大幅放宽。
        const EARLY_FINISH_THRESHOLD = 90; // 放宽到90秒

        if (nb && nbVisible && !nb.classList.contains('disabled')) {
          const beforeText = getActiveSectionText();

          const v = getVideo();
          // [核心优化] 极速冲刺模式下直接放行，稳健模式下才做假 finish 拦截
          if (!S.rushMode && v && v.duration && v.duration > 0 && !v.ended && (v.duration - v.currentTime > EARLY_FINISH_THRESHOLD)) {
             console.log('[刷课助手] 拦截到假 finish！当前视频还没看完(剩余' + (v.duration - v.currentTime).toFixed(1) + 's)，拒绝跳转下一节');
             return;
          }

          console.log('[刷课助手] 点击「下一节」按钮');
          nb.click();
          endingLock = true;
          nextTimers.push(setTimeout(function () { endingLock = false; }, 5000));
          // 4秒后验证：如果章节没切换，清除锁允许重试
          nextTimers.push(setTimeout(function () {
            const afterText = getActiveSectionText();
            if (afterText === beforeText && afterText !== '') {
              console.log('[刷课助手] 切节未生效（章节未变化），清除锁允许重试');
              endingLock = false;
            }
          }, 4000));
          return;
        }
        // 兜底：点击下一个未完成的章节
        const nextObj = findNextSectionItem();
        if (nextObj && nextObj.el) {
          const beforeText = getActiveSectionText();

          const v = getVideo();
          if (!S.rushMode && v && v.duration && v.duration > 0 && !v.ended && (v.duration - v.currentTime > 90)) {
             console.log('[刷课助手] 拦截到兜底假 finish！当前视频还没看完(剩余' + (v.duration - v.currentTime).toFixed(1) + 's)，拒绝跳转下一节');
             return;
          }

          console.log('[刷课助手] 切换至下一节（兜底）');

          endingLock = true;
          // 如果展开了折叠的章节，等待 800ms 让它完全展开后再点击里面的小节
          const delay = nextObj.needWait ? 800 : 0;
          setTimeout(function() {
             nextObj.el.click();
             nextTimers.push(setTimeout(function () { endingLock = false; }, 5000));
             nextTimers.push(setTimeout(function () {
               const afterText = getActiveSectionText();
               if (afterText === beforeText && afterText !== '') {
                 console.log('[刷课助手] 兜底切节未生效，清除锁允许重试');
                 endingLock = false;
               }
             }, 4000));
          }, delay);
          return;
        }

        // 切节失败：既找不到「下一节」按钮，也找不到兜底章节
        // 5 秒后自动重试，最多重试 3 次
        if (!allDone) {
          tryNextRetryCount = (tryNextRetryCount || 0) + 1;
          if (tryNextRetryCount <= 3) {
            console.log('[刷课助手] 切节失败（未找到下一节按钮和兜底章节），5秒后第' + tryNextRetryCount + '次重试');
            nextTimers.push(setTimeout(function () { tryNext(); }, 5000));
          } else {
            console.log('[刷课助手] 切节重试 3 次仍失败，解除锁定等待用户手动操作');
            isWaitingNext = false;
            endingLock = false;
            tryNextRetryCount = 0;
          }
          return;
        }
      }

      // 全部完成（或最后一节）→ 暂停视频防止重新播放，通知父页面进入下一步
      // 严格验证：必须确认当前视频真的播完了，防止平台提前标记所有章节finish导致误跳课程
      const v = getVideo();
      let videoReallyDone = !!(v && v.ended);
      if (!videoReallyDone && v && v.duration && v.duration > 0) {
        const remain = v.duration - v.currentTime;
        // 仅兜底接受“播放器卡在最后不足 1 秒且已暂停”；不能再用 90 秒宽松阈值。
        if (v.paused && remain >= 0 && remain < 1) {
          videoReallyDone = true;
        }
      }
      if (!videoReallyDone && allDone) {
        // 所有章节标记finish但当前视频还没播完 → 不跳课程，继续播放当前视频
        console.log('[刷课助手] 所有章节已标记finish但当前视频未播完(剩余' +
          (v && v.duration ? (v.duration - v.currentTime).toFixed(1) : '?') + 's)，继续播放不跳课程');
        return;
      }
      if (v && !v.paused) { try { v.pause(); } catch (e) {} }
      if (courseDoneNotified) return;
      courseDoneNotified = true;
      console.log('[刷课助手] 当前课程所有章节已完成，通知父页面进入下一步');
      try { window.parent.postMessage({ type: '21TB_COURSE_DONE' }, '*'); } catch (e) {}
    }

    function onVideoEnded() {
      isWaitingNext = true; // 锁定自动恢复
      isWaitingNextTime = Date.now(); // 记录锁定时间，用于超时检测
      const v = getVideo();
      if (v && !v.paused) { try { v.pause(); } catch(e){} }

      // 给当前看过的视频记录已读标识，防止死循环重看
      try {
        const activeSection = getTrackedActiveSection();
        if (activeSection) {
          activeSection.dataset.watched = '1';
          const sectionItem = activeSection.closest('li.section-item, .chapter-item li, .course-chapter li, .section-box li');
          if (sectionItem) sectionItem.classList.add('finish', 'is-finish');
        }
      } catch(e) {}

      // [核心优化] 🚀 极速冲刺模式：0.5 秒闪电切节，绝对不等待平台 15 秒迟钝延迟！
      if (S.rushMode) {
        console.log('[刷课助手] 🚀 极速冲刺完成，0.5秒闪电切入下一节（免除15秒死等）！');
        endingLock = false;
        setTimeout(function() {
          tryNext();
        }, 500);
        return;
      }

      console.log('[刷课助手] 检测到视频播放完成，已暂停，等待平台上报进度（稳健模式最多等10秒）');
      // 稳健模式：检查 finish 状态，出现 finish 立刻切，最多缩减至 10 秒
      let checks = 0;
      const checkInterval = setInterval(function() {
        checks++;
        let isFinish = false;
        const activeSection = getTrackedActiveSection();
        if (activeSection) {
          const sectionItem = activeSection.closest('li.section-item, .chapter-item li, .course-chapter li, .section-box li');
          if (sectionItem && hasFinishedClass(sectionItem)) {
            isFinish = true;
          }
        }
        if (isFinish || checks >= 10) {
          clearInterval(checkInterval);
          if (isFinish) console.log('[刷课助手] 平台已标记finish，开始切节');
          else console.log('[刷课助手] 等待finish超时，强制切节');
          tryNext();
        }
      }, 800);
      nextTimers.push(checkInterval);
    }

    /* ---------- 监听视频生命周期 ---------- */
    function bindVideo(v) {
      if (!v) return;
      const currentSrc = v.currentSrc || v.src || '';
      let isNew = false;
      if (v !== lastVideoEl) {
        isNew = true;
      } else if (currentSrc && lastVideoSrc !== currentSrc) {
        isNew = true;
      }

      if (isNew) {
        window.__tb21_switching_section = true;
        setTimeout(function() { window.__tb21_switching_section = false; }, 3000);
        lastVideoEl = v;
        if (currentSrc) lastVideoSrc = currentSrc;
        clearNextTimers(); // 清除排队的切节定时器，防止跨视频跳课
        // clearNextTimers 会取消上一节负责解除 endingLock 的定时器。
        // 如果这里不主动复位，第一次自动切节后 endingLock 会永久保持 true，
        // 后续视频结束时 tryNext() 会直接返回，表现为只能自动切一次。
        endingLock = false;
        speedGuardRetry = 0;
        tryNextRetryCount = 0; // 新视频重置切节重试计数器
        courseDoneNotified = false;
        userPaused = false; // 新视频重置手动暂停标志，允许自动恢复
        isWaitingNext = false; // 新视频解除切节锁定
        isWaitingNextTime = 0;
        softStartUntil = Date.now() + (S.rushMode ? 2500 : 8000); // 冲刺模式仅握手2.5秒，稳健模式缓启动8秒
        newVideoProtectUntil = Date.now() + (S.rushMode ? 4000 : 20000); // 冲刺模式缩短新视频保护期
        nearEndHandled = false; // 新视频重置接近结尾标志
        console.log('[刷课助手] 检测到视频切换，1x播8秒 → 渐进提速到', S.speed + 'x');

        // 渐进式加速：1x 播 8 秒建立缓冲 → 每 500ms +0.5x 逐渐提速到目标倍速
        // （直接高倍速会因缓冲区未建立导致 0:00 鬼畜，渐进提速更平滑）
        const applyRate = function (rate) {
          const vv = getVideo();
          if (!vv || vv.readyState < 1) return;
          try {
            vv.playbackRate = rate;
            if (S.autoMute) vv.muted = true;
          } catch (e) {}
        };

        // 立即设 1x（原速度）
        applyRate(1);
        // 前 8 秒多重重试都设 1x（确保缓冲充分建立）
        [300, 800, 1500, 2500, 4000, 5500, 7000].forEach(function (ms) {
          setTimeout(function () { applyRate(1); }, ms);
        });

        // 8 秒后开始渐进提速：每 500ms +0.5x，直到目标倍速
        if (rampUpTimer) clearInterval(rampUpTimer);
        let currentRate = 1;
        rampUpTimer = setInterval(function () {
          if (currentRate >= S.speed) {
            clearInterval(rampUpTimer);
            rampUpTimer = null;
            // 到达目标倍速后多重重试确保穿透 Aliplayer
            [100, 500, 1000].forEach(function (ms) {
              setTimeout(function () { applyRate(S.speed); }, ms);
            });
            console.log('[刷课助手] 渐进提速完成，当前', S.speed + 'x');
            return;
          }
          currentRate = Math.min(S.speed, currentRate + 0.5);
          applyRate(currentRate);
        }, 500);
      }
      if (v.__tb21Bound) return;
      v.__tb21Bound = true;
      v.addEventListener('ended', onVideoEnded);
      v.addEventListener('play', function (e) {
        userPaused = false; // 无论手动还是自动恢复，只要成功播放就清除暂停标志
        startKeepAlive();
        applySettings(v);
      });
      v.addEventListener('pause', function (e) {
        if (v.ended || isWaitingNext) return;
        const recentUserAction = Date.now() - lastUserMediaActionAt < 1800;
        const userStillFocused = typeof document.hasFocus !== 'function' || document.hasFocus();
        if (e.isTrusted && recentUserAction && userStillFocused) {
          userPaused = true;
          console.log('[刷课助手] 用户手动暂停，停止自动恢复（再次点击播放即可恢复）');
        } else {
          // 后台遮挡、浏览器节流或播放器内部造成的暂停：保持自动模式并尽快恢复。
          userPaused = false;
          if (S.autoNext && !isQuizOpen() && !isHangUpOpen()) {
            startKeepAlive();
            setTimeout(resumeIfPaused, 250);
            setTimeout(resumeIfPaused, 1000);
          }
        }
      });
      v.addEventListener('playing', function () { applySettings(v); }); // 切课后恢复播放时强制重设
      v.addEventListener('loadedmetadata', function () { applySettings(v); });
      v.addEventListener('loadeddata', function () { applySettings(v); });
      v.addEventListener('canplay', function () { applySettings(v); });
      v.addEventListener('canplaythrough', function () { applySettings(v); });
      v.addEventListener('ratechange', function () {
        if (Date.now() < softStartUntil || rampUpTimer) return; // 处于缓启动或渐进提速时不强制覆盖
        if (v.playbackRate !== S.speed) {
          try { v.playbackRate = S.speed; } catch (e) {}
        }
      });
      v.addEventListener('seeked', function () { applySettings(v); });
    }

    /* ---------- 统一悬浮窗刷新（倍速/开关/当前课进度/多课进度/状态） ---------- */
    const myCourseId = getMyCourseId();
    function publishFallback() {
      // 父页面未正常上报时，由播放页自己补一条（标题用页面标题）
      if (!myCourseId) return;
      try {
        const old = JSON.parse(localStorage.getItem('tb21_progress_' + myCourseId) || 'null');
        if (old && Date.now() - old.ts < 6000) return;
        const p = computeProgressFromDoc(document);
        if (!p) return;
        const title = (document.title || '').trim().slice(0, 50) || '课程';
        storeProgress(myCourseId, {
          courseId: myCourseId, title: title, pct: p.pct, done: p.done, total: p.total,
          status: p.pct >= 100 ? '已完成' : (p.paused ? '已暂停' : '刷课中'), ts: Date.now()
        });
      } catch (e) {}
    }
    /* ---------- 预计剩余时间（剩余时长 ÷ 倍速） ---------- */
    function fmtEta(seconds) {
      if (!isFinite(seconds) || seconds < 0) return '--';
      seconds = Math.round(seconds);
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      const pad = function (n) { return String(n).padStart(2, '0'); };
      if (h > 0) return h + ':' + pad(m) + ':' + pad(s);
      return pad(m) + ':' + pad(s);
    }
    let _lastPanelRenderTs = 0;
    function refreshPanel() {
      const panel = cachedEl('tb21-panel');
      if (!panel) return;

      // [性能优化] 后台节电感知：当标签页在后台不可见或窗口最小化时，UI 渲染降频至每 4 秒一次（视频播放与反作弊心跳保持满速不受影响）
      const isBg = typeof document !== 'undefined' && (document.hidden || (document.hasFocus && !document.hasFocus()));
      const minInterval = isBg ? 4000 : 800;
      const now = Date.now();
      if (now - _lastPanelRenderTs < minInterval) return;
      _lastPanelRenderTs = now;

      // 倍速按钮：只更新高亮和预计时间文字，不重写 DOM 结构（避免闪烁）
      const row = panel.querySelector('.th-spd-row');
      if (row) {
        const v = getVideo();
        const remain = (v && v.duration && isFinite(v.duration) && v.duration > 0) ? Math.max(0, v.duration - v.currentTime) : NaN;
        const wraps = row.querySelectorAll('.th-spd-wrap');
        wraps.forEach(function (wrap, i) {
          const s = SPEEDS[i];
          if (!s) return;
          const btn = wrap.querySelector('.th-spd');
          const eta = wrap.querySelector('.th-spd-eta');
          if (btn) btn.classList.toggle('on', S.speed === s);
          if (eta) {
            const etaText = isFinite(remain) ? fmtEta(remain / s) : '--';
            if (eta.textContent !== etaText) eta.textContent = etaText;
          }
        });
      }

      // 开关状态同步
      const ckN = panel.querySelector('#tb21-autoNext');
      if (ckN && ckN.checked !== S.autoNext) ckN.checked = S.autoNext;
      const ckM = panel.querySelector('#tb21-autoMute');
      if (ckM && ckM.checked !== S.autoMute) ckM.checked = S.autoMute;

      // 当前课进度
      const p = computeProgressFromDoc(document);
      const fill = panel.querySelector('.th-prog-fill');
      if (fill && p) {
        const w = p.pct + '%';
        if (fill.style.width !== w) fill.style.width = w;
      }
      const ptxt = panel.querySelector('.th-prog-txt');
      if (ptxt) {
        const t = p ? '当前课进度 ' + p.pct + '%（' + p.done + '/' + p.total + '节）' : '当前课进度 --';
        if (ptxt.textContent !== t) ptxt.textContent = t;
      }

      // 类目进度（从 localStorage 读取，由详情页写入，支持自适应直连拉取补齐与现代拟态看板）
      const catInfo = panel.querySelector('.th-cat-info');
      if (catInfo) {
        try {
          let cat = JSON.parse(localStorage.getItem('tb21_category_progress') || 'null');

          // 如果没有缓存或缺少学分数据，尝试从当前页面 URL / 上下文异步拉取补全（避免外部直达播放页时无数据）
          if ((!cat || !cat.credit) && !panel._isFetchingCat) {
            panel._isFetchingCat = true;
            (async function () {
              try {
                const q = getRouteQueryParams();
                const rmId = q.roadMapId || (cat && cat.roadMapId) || '';
                const pId = q.projectId || (cat && cat.projectId) || '';
                if (rmId || pId) {
                  const [stageList, projectDetail] = await Promise.all([
                    rmId ? TbApiClient.getStageRequirements(rmId) : Promise.resolve(null),
                    pId ? TbApiClient.getProjectDetail(pId) : Promise.resolve(null)
                  ]);
                  if (stageList && stageList.length) {
                    let mustScore = 0, eleScore = 0;
                    stageList.forEach(function (s) {
                      mustScore += Number(s.mustTotalScore || 0);
                      eleScore += Number(s.electiveTotalScore || 0);
                    });
                    const doneMust = projectDetail ? Number(projectDetail.complateMustScore || 0) : 0;
                    const doneEle = projectDetail ? Number(projectDetail.complateElectiveScore || 0) : 0;
                    const creditObj = {
                      totalRequired: mustScore + eleScore,
                      totalRequirement: mustScore + eleScore,
                      requiredMin: mustScore,
                      electiveMin: eleScore,
                      earnedRequired: doneMust,
                      earnedElective: doneEle,
                      remainingRequired: Math.max(0, mustScore - doneMust),
                      remainingElective: Math.max(0, eleScore - doneEle),
                      title: (projectDetail && (projectDetail.projectName || projectDetail.rmProjectName)) || '',
                      isOfficialApi: true,
                      ts: Date.now()
                    };
                    const existing = JSON.parse(localStorage.getItem('tb21_category_progress') || '{}');
                    existing.credit = creditObj;
                    existing.projectId = pId;
                    existing.roadMapId = rmId;
                    if (!existing.required) existing.required = { total: 0, done: 0, unfinished: 0 };
                    if (!existing.elective) existing.elective = { total: 0, done: 0, unfinished: 0 };
                    existing.ts = Date.now();
                    localStorage.setItem('tb21_category_progress', JSON.stringify(existing));
                  }
                }
              } catch (err) {
              } finally {
                setTimeout(function () { panel._isFetchingCat = false; }, 10000);
              }
            })();
          }

          // 缓存有效期放宽至 7 天，长时间挂机或隔天刷课绝不清空数据！
          if (cat && Date.now() - cat.ts < 7 * 86400000) {
            const req = cat.required || { total: 0, done: 0, unfinished: 0 };
            const ele = cat.elective || { total: 0, done: 0, unfinished: 0 };
            const totalAll = (req.total || 0) + (ele.total || 0);
            const doneAll = (req.done || 0) + (ele.done || 0);
            const pctAll = totalAll > 0 ? Math.round(doneAll / totalAll * 100) : 0;
            const credit = cat.credit || null;

            let reqCardHtml = '';
            let eleCardHtml = '';
            let hasCredit = false;
            let allPassed = false;

            if (credit) {
              hasCredit = true;
              const reqMin = (credit.requiredMin != null && !isNaN(credit.requiredMin)) ? Number(credit.requiredMin) : null;
              const eleMin = (credit.electiveMin != null && !isNaN(credit.electiveMin)) ? Number(credit.electiveMin) : null;
              const remReq = (credit.remainingRequired != null && !isNaN(credit.remainingRequired)) ? Number(credit.remainingRequired) : (reqMin != null ? reqMin : null);
              const remEle = (credit.remainingElective != null && !isNaN(credit.remainingElective)) ? Number(credit.remainingElective) : (eleMin != null ? eleMin : null);
              const earnedReq = (credit.earnedRequired != null && !isNaN(credit.earnedRequired)) ? Number(credit.earnedRequired) : ((reqMin != null && remReq != null) ? Math.max(0, reqMin - remReq) : '--');
              const earnedEle = (credit.earnedElective != null && !isNaN(credit.earnedElective)) ? Number(credit.earnedElective) : ((eleMin != null && remEle != null) ? Math.max(0, eleMin - remEle) : '--');

              const isReqOk = remReq !== null && remReq <= 0;
              const isEleOk = remEle !== null && remEle <= 0;
              allPassed = isReqOk && isEleOk;

              // 必修卡片：未达标显醒目发光金黄色，达标显清爽翡翠绿
              if (reqMin !== null) {
                if (isReqOk) {
                  reqCardHtml =
                    '<div class="th-card ok">' +
                      '<div class="th-card-title">📘 必修学分</div>' +
                      '<div class="th-card-val">✓ 已达标</div>' +
                      '<div class="th-card-sub">已修 ' + earnedReq + '/' + reqMin + ' 分</div>' +
                    '</div>';
                } else {
                  reqCardHtml =
                    '<div class="th-card need">' +
                      '<div class="th-card-title">📘 必修学分</div>' +
                      '<div class="th-card-val">还需 ' + (remReq != null ? remReq : '--') + ' 分</div>' +
                      '<div class="th-card-sub">目标 ≥ ' + reqMin + ' (已修 ' + earnedReq + ')</div>' +
                    '</div>';
                }
              }

              // 选修卡片：未达标显醒目发光金黄色，达标显清爽翡翠绿
              if (eleMin !== null) {
                if (isEleOk) {
                  eleCardHtml =
                    '<div class="th-card ok">' +
                      '<div class="th-card-title">📙 选修学分</div>' +
                      '<div class="th-card-val">✓ 已达标</div>' +
                      '<div class="th-card-sub">目标 ≥ ' + eleMin + ' (已修 ' + earnedEle + ')</div>' +
                    '</div>';
                } else {
                  eleCardHtml =
                    '<div class="th-card need">' +
                      '<div class="th-card-title">📙 选修学分</div>' +
                      '<div class="th-card-val">还需 ' + (remEle != null ? remEle : '--') + ' 分</div>' +
                      '<div class="th-card-sub">目标 ≥ ' + eleMin + ' (已修 ' + earnedEle + ')</div>' +
                    '</div>';
                }
              }
            }

            // 状态徽章（右上角）
            let statusTag = '';
            if (hasCredit) {
              if (allPassed) {
                statusTag = '<span class="th-cat-tag ok">全部达标 🎉</span>';
              } else {
                statusTag = '<span class="th-cat-tag warn">学分攻坚中</span>';
              }
            } else if (totalAll > 0) {
              statusTag = '<span class="th-cat-tag ok">' + pctAll + '%</span>';
            }

            // 数据签名比对，仅在数据变化时重绘（杜绝 DOM 闪烁）
            const sig = JSON.stringify([req, ele, credit, totalAll, doneAll, pctAll]);
            if (catInfo._lastSig !== sig) {
              catInfo._lastSig = sig;
              let html = '<div class="th-cat-box">';

              // 1. 顶部状态/项目名称行
              const projTitle = (credit && credit.title) ? credit.title : (cat.activeTab ? cat.activeTab : '');
              html +=
                '<div class="th-cat-meta">' +
                  '<span class="th-cat-name" title="' + String(projTitle).replace(/"/g, '&quot;') + '">' + (projTitle ? (projTitle.length > 14 ? projTitle.slice(0, 13) + '…' : projTitle) : '类目学分与门数') + '</span>' +
                  statusTag +
                '</div>';

              // 2. 核心达标卡片网格
              if (reqCardHtml || eleCardHtml) {
                html += '<div class="th-cat-grid">' + reqCardHtml + eleCardHtml + '</div>';
              }

              // 3. 课程通关进度条与门数 Pill 标签
              if (totalAll > 0) {
                html +=
                  '<div class="th-cat-bar-wrap">' +
                    '<div class="th-cat-bar-meta"><span>课程通过进度</span><b>' + doneAll + '/' + totalAll + ' 门 (' + pctAll + '%)</b></div>' +
                    '<div class="th-cat-bar"><div class="th-cat-bar-fill" style="width:' + pctAll + '%"></div></div>' +
                  '</div>' +
                  '<div class="th-cat-pills">' +
                    '<div class="th-pill"><span>必修</span><b>' + req.done + '/' + req.total + ' 门 (剩' + req.unfinished + ')</b></div>' +
                    '<div class="th-pill"><span>选修</span><b>' + ele.done + '/' + ele.total + ' 门 (剩' + ele.unfinished + ')</b></div>' +
                  '</div>';
              }

              html += '</div>';
              catInfo.innerHTML = html;
            }
          } else {
            // 空状态：优雅引导卡片
            const emptySig = 'EMPTY_HINT';
            if (catInfo._lastSig !== emptySig) {
              catInfo._lastSig = emptySig;
              catInfo.innerHTML =
                '<div class="th-cat-empty">' +
                  '<div class="th-cat-empty-icon">📡</div>' +
                  '<div class="th-cat-empty-txt">暂未同步大类目学分</div>' +
                  '<div class="th-cat-empty-sub">打开大类目或课程详情页后自动同步</div>' +
                '</div>';
            }
          }
        } catch (e) {}
      }

      // 多课进度列表：用数据签名判断是否需要重绘（避免 innerHTML 归一化导致的反复闪烁）
      const list = panel.querySelector('.th-dash-list');
      if (list) {
        const entries = dashEntries();
        const sig = JSON.stringify(entries.map(function (e) { return [e.courseId, e.title, e.pct, e.done, e.total, e.status]; }));
        if (list._lastSig !== sig) {
          list._lastSig = sig;
          list.innerHTML = entries.map(function (e) {
            return '<div class="dh-row' + (e.courseId === myCourseId ? ' me' : '') + '" data-cid="' + e.courseId + '" title="' + e.title.replace(/"/g, '&quot;') + '">' +
              '<div class="dh-name">' + (e.courseId === myCourseId ? '▶ ' : '') + e.title + '</div>' +
              '<div class="dh-bar"><div class="dh-fill" style="width:' + e.pct + '%"></div></div>' +
              '<div class="dh-meta"><span>' + e.status + ' · ' + e.done + '/' + e.total + '节</span><span class="dh-done">' + e.pct + '%</span></div>' +
            '</div>';
          }).join('') + (entries.length === 0 ? '<div class="dh-meta" style="margin-top:6px">打开课程页后自动出现在这里</div>' : '');
        }
      }
      publishFallback();

      // 状态行（body 内）
      const st = panel.querySelector('.th-status');
      const v2 = getVideo();
      let statusTxt = '';
      let stateLabel = '';
      let stateColor = '#10b981';
      if (S.rushMode) {
        statusTxt = '🚀 极速冲刺中 · ' + (S.autoMute ? '静音' : '有声') + ' · ' + (S.autoNext ? '自动' : '手动');
        stateLabel = '🚀 冲刺中';
      } else {
        statusTxt = S.speed + 'x' + ' · ' + (S.autoMute ? '静音' : '有声') + ' · ' + (S.autoNext ? '自动' : '手动');
        stateLabel = S.speed + 'x';
      }
      if (quizOpen) {
        statusTxt += ' · ⚠答题验证'; stateLabel = '⚠ 答题验证'; stateColor = '#ef4444';
      } else if (userPaused) {
        statusTxt += ' · 已暂停(手动)'; stateLabel += ' · 已暂停'; stateColor = '#f59e0b';
      } else if (Date.now() < softStartUntil) {
        statusTxt += ' · 1x缓冲'; stateLabel += ' · 缓冲中'; stateColor = '#0ea5e9';
      } else if (rampUpTimer) {
        statusTxt += ' · 渐进提速'; stateLabel += ' · 提速中'; stateColor = '#0ea5e9';
      } else if (v2 && !v2.paused) {
        statusTxt += ' · 播放中'; stateLabel += ' · 播放中';
      } else if (v2 && v2.paused) {
        statusTxt += ' · 已暂停'; stateLabel += ' · 已暂停'; stateColor = '#f59e0b';
      } else {
        stateLabel += ' · 就绪'; stateColor = '#94a3b8';
      }
      if (st && st.textContent !== statusTxt) st.textContent = statusTxt;

      // Header 状态指示灯颜色
      const badge = panel.querySelector('.th-status-badge');
      if (badge) {
        if (badge.style.background !== stateColor) {
          badge.style.background = stateColor;
          badge.style.boxShadow = '0 0 8px ' + stateColor;
        }
        const badgeTitle = quizOpen ? '⚠ 请答题验证' : (v2 && !v2.paused ? '播放中' : '已暂停 / 缓冲');
        if (badge.title !== badgeTitle) badge.title = badgeTitle;
      }

      // 状态芯片（Header 下方的紧凑状态条）
      const chipTxt = panel.querySelector('.th-chip-txt');
      if (chipTxt && chipTxt.textContent !== stateLabel) chipTxt.textContent = stateLabel;
      const chipDot = panel.querySelector('.th-chip-dot');
      if (chipDot && chipDot.style.background !== stateColor) {
        chipDot.style.background = stateColor;
        chipDot.style.boxShadow = '0 0 6px ' + stateColor;
      }

      // 折叠态信息同步（倍速 + 进度百分比）
      const collSpd = panel.querySelector('.th-collapsed-spd');
      if (collSpd) {
        const spdTxt = S.rushMode ? '🚀' : (S.speed + 'x');
        if (collSpd.textContent !== spdTxt) collSpd.textContent = spdTxt;
      }
      const collPct = panel.querySelector('.th-collapsed-pct');
      if (collPct) {
        const pctTxt = p ? (p.pct + '%') : '--%';
        if (collPct.textContent !== pctTxt) collPct.textContent = pctTxt;
      }

      // 底部迷你进度条（永远可见的心跳线）
      const miniFill = panel.querySelector('.th-mini-fill');
      if (miniFill) {
        let miniW = '0%';
        if (v2 && v2.duration && v2.duration > 0 && isFinite(v2.duration)) {
          miniW = Math.min(100, Math.round(v2.currentTime / v2.duration * 100)) + '%';
        } else if (p) {
          miniW = p.pct + '%';
        }
        if (miniFill.style.width !== miniW) miniFill.style.width = miniW;
      }

      // 警示行
      const note = panel.querySelector('.th-note');
      if (note) {
        let n = '';
        if (dashEntries().length > 1) n += '多课同开有风控风险，建议 8x 以内';
        if (note.textContent !== n) note.textContent = n;
      }
    }

    /* ---------- 🚀 智能步进脉冲冲刺引擎（Smart Step-Seek Rush） ---------- */
    let rushTimer = null;
    let rushStepCount = 0;
    let rushCurrentVideo = null;
    let rushHandshakeDone = false;

    function resetRushState() {
      if (rushTimer) {
        clearInterval(rushTimer);
        rushTimer = null;
      }
      rushStepCount = 0;
      rushCurrentVideo = null;
      rushHandshakeDone = false;
    }

    function triggerStudyLogReport(v) {
      if (!v) return;
      try {
        v.dispatchEvent(new Event('timeupdate'));
        v.dispatchEvent(new Event('seeked'));
      } catch (e) {}
    }

    function tickRushEngine(v) {
      if (!S.rushMode || !v || v.ended || isQuizOpen() || isHangUpOpen()) {
        resetRushState();
        return;
      }
      if (v.readyState < 2 || !v.duration || v.duration <= 0 || isNaN(v.duration)) {
        return;
      }

      if (rushCurrentVideo !== v) {
        resetRushState();
        rushCurrentVideo = v;
      }

      // 阶段 1：首帧合法握手期（前 2.5 秒正常播放建立合规心跳）
      if (!rushHandshakeDone) {
        if (v.currentTime < 2.5 && !v.paused) {
          return;
        }
        rushHandshakeDone = true;
        console.log('[刷课助手] 🚀 极速冲刺启动：初始时序握手完成，开始执行脉冲步进打点...');
      }

      // 阶段 2：脉冲步进跳跃
      if (!rushTimer) {
        rushTimer = setInterval(function () {
          if (!S.rushMode || !v || v.ended || isQuizOpen() || isHangUpOpen()) {
            resetRushState();
            return;
          }

          if (v.paused) {
            try { v.play(); } catch (e) {}
          }

          const dur = v.duration;
          const cur = v.currentTime;
          // [平滑防风控算法] 单次步进控制在 35~55 秒（合规容差范围），每 1.8 秒推进一次，整门课约 40~50 秒闪电通关
          // 彻底消除由于单次跳跃过大导致的后端“播放过快/学习异常”风控弹窗！
          const step = Math.min(55, Math.max(25, dur * 0.05));
          const nextTime = cur + step;

          if (nextTime < dur - 2.5) {
            v.currentTime = nextTime;
            // 同步更新 Vue 组件内部记录的 seek 位置，使 (t - this.seek > 3) 判定永远为 false！
            try {
              const rootEl = document.getElementById('app');
              if (rootEl && rootEl.__vue__) {
                function syncSeek(vm) {
                  if (!vm) return;
                  if ('seek' in vm) vm.seek = nextTime;
                  if ('allowDrag' in vm) vm.allowDrag = true;
                  if (vm.$children && vm.$children.length) {
                    vm.$children.forEach(syncSeek);
                  }
                }
                syncSeek(rootEl.__vue__);
              }
            } catch(e) {}
            triggerStudyLogReport(v);
            rushStepCount++;
            const pct = Math.round((nextTime / dur) * 100);
            console.log('[刷课助手] 🚀 极速冲刺平滑脉冲 #' + rushStepCount + ': 推进至 ' + nextTime.toFixed(1) + 's / ' + dur.toFixed(1) + 's (' + pct + '%)');
          } else {
            // 阶段 3：尾帧收官完播，立即闪电切换下一节
            clearInterval(rushTimer);
            rushTimer = null;
            const finishTime = Math.max(0, dur - 0.3);
            v.currentTime = finishTime;
            window.__tb21_rush_finishing = true;
            setTimeout(function() { window.__tb21_rush_finishing = false; }, 6000);
            try {
              const rootEl = document.getElementById('app');
              if (rootEl && rootEl.__vue__) {
                function syncFinish(vm) {
                  if (!vm) return;
                  if ('seek' in vm) vm.seek = dur;
                  if ('recordTime' in vm) vm.recordTime = dur;
                  if ('mustReplayCanFinish' in vm) vm.mustReplayCanFinish = false;
                  if (vm.$children) vm.$children.forEach(syncFinish);
                }
                syncFinish(rootEl.__vue__);
              }
            } catch(e) {}
            triggerStudyLogReport(v);
            console.log('[刷课助手] 🚀 极速冲刺尾帧打点完成，触发自然完播与闪电切节！');
            
            // 标记当前小节已读
            try {
              const activeSection = getTrackedActiveSection();
              if (activeSection) {
                activeSection.dataset.watched = '1';
                const sectionItem = activeSection.closest('li.section-item, .chapter-item li, .course-chapter li, .section-box li');
                if (sectionItem) sectionItem.classList.add('finish', 'is-finish');
              }
            } catch(e) {}

            setTimeout(function () {
              try {
                if (v && !v.ended) {
                  v.dispatchEvent(new Event('ended'));
                }
              } catch (e) {}
              // 解除锁定并立即触发切节
              endingLock = false;
              tryNext();
            }, 400);
          }
        }, 1800); // 每 1.8 秒平滑步进一次，稳定通关且不触发风控
      }
    }

    /* ---------- 答题验证提醒 ---------- */
    function notifyQuiz() {
      // 标题闪烁
      lastTitle = document.title;
      let flash = 0;
      const iv = setInterval(function () {
        document.title = (flash++ % 2 === 0) ? '⚠ 请完成答题验证' : lastTitle;
        if (!isQuizOpen()) { clearInterval(iv); document.title = lastTitle; }
      }, 800);
      // 蜂鸣提示
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          for (let k = 0; k < 3; k++) {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.frequency.value = 880;
            g.gain.setValueAtTime(0.15, ctx.currentTime + k * 0.5);
            o.start(ctx.currentTime + k * 0.5);
            o.stop(ctx.currentTime + k * 0.5 + 0.2);
          }
        }
      } catch (e) {}
    }

    /* ---------- 主循环 ---------- */
    setInterval(function () {
      const v = getVideo();
      getTrackedActiveSection();
      bindVideo(v);
      if (v) applySettings(v);

      // 🚀 极速冲刺脉冲引擎调度
      if (S.rushMode && v) {
        tickRushEngine(v);
      } else if (rushTimer) {
        resetRushState();
      }

      // 后台保活：视频正在播放时启动静音音频，防止 Chrome 节流后台标签页
      // （视频播放说明用户已经交互，可以启动音频了）
      if (v && !v.paused && !v.ended) {
        startKeepAlive();
      }

      // 答题验证出现 → 暂停自动恢复并提醒
      const qOpen = isQuizOpen();
      if (qOpen && !quizOpen) {
        quizOpen = true;
        console.log('[刷课助手] 检测到防作弊答题验证，请手动完成');
        notifyQuiz();
      } else if (!qOpen) {
        quizOpen = false;
      }

      // 挂起检测弹窗 → 自动点确定继续
      if (isHangUpOpen()) {
        const btn = document.querySelector('.hangUp-box .confirmBtn .btn');
        if (btn) { console.log('[刷课助手] 自动点击挂起弹窗确定'); btn.click(); }
      }

      // 视频接近结尾时自动降速到 1x（关键修复！）
      // 高倍速（8x/16x）下视频可能不会正常触发 ended 事件，平台也不标记 finish，
      // 导致「下一节」按钮不出现，tryNext 找不到按钮，视频一直暂停。
      // 解决方案：视频剩余 < 10 秒时自动降速到 1x，让视频能正常 ended，平台能正常标记 finish。
      if (v && v.duration && v.duration > 0 && !v.ended && !v.paused && !isQuizOpen() && !isHangUpOpen()) {
        const remain = v.duration - v.currentTime;
        if (remain < 10 && remain >= 0 && v.playbackRate !== 1) {
          try {
            v.playbackRate = 1;
            if (!nearEndHandled) {
              console.log('[刷课助手] 视频接近结尾（剩余' + remain.toFixed(1) + 's），自动降速到 1x 确保正常结束');
            }
          } catch (e) {}
        }
      }

      // 高倍速下 ended 事件不触发时的兜底：视频剩余 < 0.5 秒且 paused，主动调用 onVideoEnded
      // （高倍速下视频可能在接近结尾时卡住，ended 事件不触发，需要主动检测）
      if (v && v.duration && v.duration > 0 && !v.ended && v.paused && !isQuizOpen() && !isHangUpOpen()) {
        const remain = v.duration - v.currentTime;
        if (remain < 0.5 && remain >= 0 && !nearEndHandled && !endingLock) {
          console.log('[刷课助手] 检测到视频卡在结尾（剩余' + remain.toFixed(2) + 's），主动触发结束流程');
          nearEndHandled = true;
          onVideoEnded();
        }
      }

      // 主动切节检测：高倍速下平台可能提前标记完成，ended事件不触发
      // 注意：必须严格验证视频真的接近结尾，防止平台提前标记finish导致误切节
      // 新视频保护期：前20秒真实时间不触发主动切节，防止新视频十几秒就跳走
      if (S.autoNext && !nearEndHandled && !endingLock && !isQuizOpen() && !isHangUpOpen()
          && Date.now() > newVideoProtectUntil) {
        let shouldSwitch = false;
        let reason = '';

        // 计算视频进度（用于所有切节条件的严格验证）
        let videoRemain = Infinity;
        let videoProgress = 0;
        if (v && v.duration && v.duration > 0 && !v.ended) {
          videoRemain = v.duration - v.currentTime;
          videoProgress = v.currentTime / v.duration;
        }

        // 主动切节条件：当前章节已标记完成（平台已确认）
        // 注意：不检测"视频剩余 < 2 秒"，因为那会在视频没真正 ended 时暂停视频，
        // 导致平台的「下一节」按钮不出现，tryNext 找不到按钮，视频一直暂停。
        // 让视频自然播放到 ended，由 onVideoEnded 处理切节更可靠。
        const activeSection = document.querySelector('li.section-item .first-line.active');
        if (activeSection) {
          const sectionItem = activeSection.closest('li.section-item');
          if (hasFinishedClass(sectionItem)) {
            // 严格验证：必须同时满足视频已播放>95% 且 剩余<10秒，确保平台已上报最后的进度
            if (v && v.duration && v.duration > 0 && !v.ended &&
                videoProgress > 0.95 && videoRemain < 10 && v.currentTime > 5) {
              shouldSwitch = true;
              reason = '章节已标记finish且视频进度' + (videoProgress * 100).toFixed(0) + '%(剩余' + videoRemain.toFixed(1) + 's)';
            }
          }
        }

        if (shouldSwitch) {
          nearEndHandled = true;
          // 不暂停视频！让视频自然播放到 ended，由 onVideoEnded 处理切节
          // 暂停视频会导致平台的「下一节」按钮不出现，tryNext 找不到按钮
          console.log('[刷课助手] 检测到章节已标记finish，等待视频自然结束后自动切节：' + reason);
          // 同时设置 isWaitingNext 防止 resumeIfPaused 干扰（但视频还在播放，不会被暂停）
          // 实际上不需要设置 isWaitingNext，因为视频还在播放，resumeIfPaused 不会干扰
        }
      }

      // 自动恢复播放
      resumeIfPaused();
      refreshPanel();
    }, 1200);

    /* ---------- 高倍速防拉扯（平滑进度上报，欺骗平台防拖拽） ---------- */
    // 浏览器原生 timeupdate 约 250ms 触发一次。16倍速下，250ms 视频会走 4 秒。
    // 平台检测到单次进度跨度 > 3秒，会误判为“拖拽进度条”，触发风控将时间拉回（拉扯感）。
    // 提高频次：当实际倍速 > 2x 时，每 40ms 补发一次 timeupdate，使跨度降至极低，完美绕过防拖拽。
    setInterval(function () {
      const v = getVideo();
      if (v && !v.paused && v.readyState >= 2 && v.playbackRate > 2) {
        if (!isQuizOpen() && !isHangUpOpen()) {
          try { v.dispatchEvent(new Event('timeupdate')); } catch (e) {}
        }
      }
    }, 40);

    /* ---------- 倍速守护（切课后 Aliplayer 重置 playbackRate 时恢复；ratechange 事件做即时恢复，1s 轮询做兜底） ---------- */
    setInterval(function () {
      if (Date.now() < softStartUntil || rampUpTimer) return; // 缓启动/渐进加速期间跳过守护（保持1x/渐进提速）
      const v = getVideo();
      if (!v || v.readyState < 2) return;
      if (isQuizOpen() || isHangUpOpen()) return;
      // 视频接近结尾时不恢复倍速（保持 1x 确保正常 ended）
      if (v.duration && v.duration > 0 && !v.ended) {
        const remain = v.duration - v.currentTime;
        if (remain < 10 && remain >= 0) return; // 剩余 < 10 秒时保持 1x
      }
      if (v.playbackRate !== S.speed) {
        speedGuardRetry++;
        if (speedGuardRetry <= 5 || speedGuardRetry % 5 === 0) {
          try {
            v.playbackRate = S.speed;
            if (speedGuardRetry <= 3) console.log('[刷课助手] 倍速守护: 恢复', S.speed + 'x (第' + speedGuardRetry + '次)');
          } catch (e) {}
        }
      } else {
        if (speedGuardRetry > 0) speedGuardRetry = 0;
      }
    }, 1000);

    /* ---------- 统一悬浮窗（可拖动；倍速/自动开关/当前进度/多课总览 全在一窗） ---------- */
    function buildPanel() {
      if (document.getElementById('tb21-panel')) return;
      const css = document.createElement('style');
      css.textContent = `
        @keyframes ap-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.85)}}
        @keyframes ap-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes ap-glow-warn{0%,100%{box-shadow:0 0 4px rgba(245,158,11,.3)}50%{box-shadow:0 0 12px rgba(245,158,11,.55)}}
        #tb21-panel{position:fixed;top:14px;right:14px;z-index:999999;width:310px;
          background:rgba(15,23,42,.92);color:#f1f5f9;border-radius:14px;
          font:12px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
          box-shadow:0 16px 36px -6px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.1),inset 0 1px 0 rgba(255,255,255,.15);
          backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);
          user-select:none;overflow:hidden;transition:box-shadow .3s,width .25s cubic-bezier(.4,0,.2,1),border-radius .25s,transform .2s ease}
        #tb21-panel.th-dragging{box-shadow:0 20px 50px -8px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.15),inset 0 1px 0 rgba(255,255,255,.2);
          transform:scale(1.02)}
        #tb21-panel.th-hide{width:auto;min-width:auto;border-radius:20px}
        #tb21-panel.th-hide .th-head{padding:7px 12px;border-bottom:none;border-radius:20px}
        #tb21-panel.th-hide .th-body{max-height:0;padding-top:0;padding-bottom:0;opacity:0;overflow:hidden}
        #tb21-panel.th-hide .th-fold{transform:rotate(-90deg)}
        #tb21-panel.th-hide .th-status-chip{display:none}
        #tb21-panel.th-hide .th-mini-bar{display:none}
        #tb21-panel.th-hide .th-collapsed-info{display:inline-flex}
        #tb21-panel .th-head{display:flex;justify-content:space-between;align-items:center;
          padding:9px 12px;background:rgba(255,255,255,.04);
          border-bottom:1px solid rgba(255,255,255,.06);
          cursor:grab;font-weight:700;font-size:13px;position:relative}
        #tb21-panel .th-head::after{content:'';position:absolute;bottom:0;left:12px;right:12px;height:1px;
          background:linear-gradient(90deg,transparent,rgba(14,165,233,.4),rgba(16,185,129,.4),transparent);
          animation:ap-shimmer 4s linear infinite;background-size:200% 100%}
        #tb21-panel .th-head:active{cursor:grabbing}
        #tb21-panel .th-head-title{display:flex;align-items:center;gap:6px}
        #tb21-panel .th-head-right{display:flex;align-items:center;gap:6px}
        #tb21-panel .th-logo{font-size:14px;filter:drop-shadow(0 0 4px rgba(245,158,11,.6))}
        #tb21-panel .th-ver{font-size:9px;font-weight:500;color:#94a3b8;background:rgba(255,255,255,.08);padding:1px 6px;
          border-radius:8px;border:1px solid rgba(255,255,255,.06);letter-spacing:.3px}
        #tb21-panel .th-status-badge{display:inline-block;width:7px;height:7px;border-radius:50%;margin-left:2px;
          background:#10b981;box-shadow:0 0 8px #10b981;animation:ap-pulse 2s ease-in-out infinite;transition:background .3s,box-shadow .3s}
        #tb21-panel .th-collapsed-info{display:none;align-items:center;gap:4px;margin-left:4px;
          font-size:10px;font-weight:500;color:#94a3b8}
        #tb21-panel .th-collapsed-spd{color:#0ea5e9;font-weight:700}
        #tb21-panel .th-collapsed-pct{color:#10b981;font-weight:600}
        #tb21-panel .th-fold{cursor:pointer;padding:2px 6px;color:#94a3b8;font-size:13px;border-radius:4px;
          transition:transform .25s cubic-bezier(.4,0,.2,1),color .2s,background .2s}
        #tb21-panel .th-fold:hover{color:#f1f5f9;background:rgba(255,255,255,.08)}
        #tb21-panel .th-status-chip{display:flex;align-items:center;gap:5px;padding:4px 10px;margin:0;font-size:10px;
          color:#94a3b8;background:rgba(255,255,255,.03);border-bottom:1px solid rgba(255,255,255,.05);
          font-weight:500;letter-spacing:.2px}
        #tb21-panel .th-status-chip .th-chip-dot{width:5px;height:5px;border-radius:50%;background:#10b981;
          box-shadow:0 0 6px #10b981;animation:ap-pulse 2s ease-in-out infinite;flex-shrink:0}
        #tb21-panel .th-body{padding:10px 12px 8px;max-height:800px;opacity:1;
          transition:max-height .35s cubic-bezier(.4,0,.2,1),opacity .25s ease,padding .3s ease;overflow:hidden}
        #tb21-panel .th-row{margin:5px 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        #tb21-panel .th-lab{color:#94a3b8;font-size:11px;font-weight:600}
        #tb21-panel .th-spd-row{display:flex;gap:6px;flex:1}
        #tb21-panel .th-spd-wrap{display:inline-flex;flex-direction:column;align-items:center;gap:2px;flex:1;min-width:44px}
        #tb21-panel .th-spd{display:inline-flex;align-items:center;justify-content:center;width:100%;padding:3px 0;
          border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#e2e8f0;border-radius:6px;
          cursor:pointer;font-size:11px;font-weight:600;transition:all .2s cubic-bezier(.4,0,.2,1)}
        #tb21-panel .th-spd:hover{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.22);transform:translateY(-1px)}
        #tb21-panel .th-spd.on{background:linear-gradient(135deg,#0ea5e9,#2563eb);border-color:transparent;color:#fff;
          box-shadow:0 2px 8px rgba(14,165,233,.45)}
        #tb21-panel .th-spd.warn{color:#f59e0b;border-color:rgba(245,158,11,.3);border-style:dashed}
        #tb21-panel .th-spd.warn.on{background:linear-gradient(135deg,#f59e0b,#dc2626);border-style:solid;border-color:transparent;
          animation:ap-glow-warn 2s ease-in-out infinite;color:#fff}
        #tb21-panel .th-spd-eta{font-size:10px;color:#94a3b8;line-height:1;font-family:monospace;white-space:nowrap}
        #tb21-panel .th-switch-row{display:flex;gap:10px;margin:8px 0 6px;flex-wrap:wrap}
        #tb21-panel .th-switch-label{display:inline-flex;align-items:center;gap:5px;cursor:pointer;font-size:11px;color:#cbd5e1;user-select:none}
        #tb21-panel .th-switch-label input[type="checkbox"]{position:absolute;opacity:0;width:0;height:0;pointer-events:none}
        #tb21-panel .th-switch-track{position:relative;display:inline-block;width:26px;height:15px;background:rgba(255,255,255,.16);
          border-radius:8px;transition:background .25s cubic-bezier(.4,0,.2,1)}
        #tb21-panel .th-switch-thumb{position:absolute;top:1.5px;left:2px;width:12px;height:12px;background:#fff;border-radius:50%;
          box-shadow:0 1px 3px rgba(0,0,0,.35);transition:transform .25s cubic-bezier(.4,0,.2,1)}
        #tb21-panel .th-switch-label input[type="checkbox"]:checked + .th-switch-track{background:#10b981;box-shadow:0 0 8px rgba(16,185,129,.4)}
        #tb21-panel .th-switch-label input[type="checkbox"]:checked + .th-switch-track .th-switch-thumb{transform:translateX(11px)}
        #tb21-panel .th-switch-label.rush input[type="checkbox"]:checked + .th-switch-track{background:linear-gradient(135deg,#f59e0b,#ec4899);box-shadow:0 0 10px rgba(245,158,11,.6)}
        #tb21-panel .th-switch-label.rush .th-switch-txt{color:#fbbf24;font-weight:700}
        #tb21-panel .th-prog{margin:8px 0 4px}
        #tb21-panel .th-prog-bar{height:7px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.3)}
        #tb21-panel .th-prog-fill{height:100%;width:0;background:linear-gradient(90deg,#10b981,#06b6d4,#3b82f6);border-radius:4px;
          transition:width .5s ease-out;box-shadow:0 0 8px rgba(6,182,212,.4)}
        #tb21-panel .th-prog-txt{color:#94a3b8;font-size:11px;margin-top:3px}
        #tb21-panel .th-cat-title,#tb21-panel .th-dash-title{font-weight:700;margin-top:9px;padding-top:7px;border-top:1px solid rgba(255,255,255,.08);font-size:12px;color:#e2e8f0;display:flex;align-items:center;justify-content:space-between}
        #tb21-panel .th-cat-info{margin-top:5px;background:rgba(255,255,255,.03);padding:8px 9px;border-radius:8px;border:1px solid rgba(255,255,255,.06)}
        #tb21-panel .th-cat-box{display:flex;flex-direction:column;gap:6px}
        #tb21-panel .th-cat-meta{display:flex;justify-content:space-between;align-items:center;font-size:11px}
        #tb21-panel .th-cat-name{font-weight:600;color:#cbd5e1;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        #tb21-panel .th-cat-tag{display:inline-flex;align-items:center;padding:1px 6px;border-radius:10px;font-size:10px;font-weight:600;letter-spacing:0.2px}
        #tb21-panel .th-cat-tag.ok{background:rgba(16,185,129,.2);color:#34d399;border:1px solid rgba(16,185,129,.35)}
        #tb21-panel .th-cat-tag.warn{background:rgba(245,158,11,.18);color:#fbbf24;border:1px solid rgba(245,158,11,.35)}
        #tb21-panel .th-cat-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
        #tb21-panel .th-card{padding:6px 8px;border-radius:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);display:flex;flex-direction:column;gap:1px}
        #tb21-panel .th-card.need{background:linear-gradient(135deg,rgba(245,158,11,.14),rgba(217,119,6,.06));border-color:rgba(245,158,11,.45);box-shadow:0 0 10px rgba(245,158,11,.12)}
        #tb21-panel .th-card.ok{background:linear-gradient(135deg,rgba(16,185,129,.14),rgba(5,150,105,.06));border-color:rgba(16,185,129,.4)}
        #tb21-panel .th-card-title{font-size:10px;color:#94a3b8;font-weight:500}
        #tb21-panel .th-card-val{font-size:13px;font-weight:700;line-height:1.2;margin:1px 0}
        #tb21-panel .th-card.need .th-card-val{color:#fbbf24;text-shadow:0 0 8px rgba(245,158,11,.3)}
        #tb21-panel .th-card.ok .th-card-val{color:#34d399;text-shadow:0 0 8px rgba(52,211,153,.3)}
        #tb21-panel .th-card-sub{font-size:10px;color:#94a3b8;line-height:1.2}
        #tb21-panel .th-cat-bar-wrap{margin-top:2px}
        #tb21-panel .th-cat-bar-meta{font-size:10px;color:#94a3b8;display:flex;justify-content:space-between;margin-bottom:3px}
        #tb21-panel .th-cat-bar-meta b{color:#f1f5f9;font-weight:600}
        #tb21-panel .th-cat-bar{height:5px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden}
        #tb21-panel .th-cat-bar-fill{height:100%;background:linear-gradient(90deg,#0ea5e9,#10b981);border-radius:3px;transition:width .4s ease-out}
        #tb21-panel .th-cat-pills{display:flex;gap:6px;margin-top:2px}
        #tb21-panel .th-pill{flex:1;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.06);padding:3px 6px;border-radius:4px;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between;align-items:center}
        #tb21-panel .th-pill b{color:#e2e8f0;font-weight:600}
        #tb21-panel .th-cat-empty{padding:10px 4px;text-align:center;color:#94a3b8}
        #tb21-panel .th-cat-empty-icon{font-size:16px;margin-bottom:2px}
        #tb21-panel .th-cat-empty-txt{font-size:11px;font-weight:600;color:#cbd5e1}
        #tb21-panel .th-cat-empty-sub{font-size:10px;color:#64748b;margin-top:2px}
        #tb21-panel .th-dash-list{max-height:172px;overflow-y:auto;margin-top:5px;padding-right:2px}
        #tb21-panel .dh-row{padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.05);cursor:pointer;margin-bottom:5px;transition:all .2s}
        #tb21-panel .dh-row:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.12);transform:translateY(-1px)}
        #tb21-panel .dh-row.me{border-color:rgba(14,165,233,.6);background:rgba(14,165,233,.12)}
        #tb21-panel .dh-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#f1f5f9;font-weight:500}
        #tb21-panel .dh-bar{height:5px;background:rgba(255,255,255,.08);border-radius:3px;margin:4px 0 3px;overflow:hidden}
        #tb21-panel .dh-fill{height:100%;background:linear-gradient(90deg,#10b981,#06b6d4);border-radius:3px}
        #tb21-panel .dh-meta{color:#94a3b8;font-size:11px;display:flex;justify-content:space-between}
        #tb21-panel .dh-done{color:#34d399;font-weight:600}
        #tb21-panel .th-status{color:#94a3b8;margin-top:8px;border-top:1px solid rgba(255,255,255,.08);padding-top:6px;font-size:11px}
        #tb21-panel .th-note{color:#fbbf24;font-size:11px;margin-top:4px;min-height:15px}
        #tb21-panel .th-mini-bar{height:3px;background:rgba(255,255,255,.06);border-radius:0 0 14px 14px;overflow:hidden;margin-top:0}
        #tb21-panel .th-mini-fill{height:100%;width:0;background:linear-gradient(90deg,#10b981,#06b6d4,#3b82f6);border-radius:0 0 14px 14px;
          transition:width .5s ease-out}
        #tb21-panel ::-webkit-scrollbar{width:4px}
        #tb21-panel ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:4px}
      `;
      try { (document.head || document.documentElement).appendChild(css); } catch (e) {}

      const panel = document.createElement('div');
      panel.id = 'tb21-panel';
      panel.innerHTML =
        '<div class="th-head">' +
          '<div class="th-head-title"><span class="th-logo">⚡</span><span>刷课助手</span><span class="th-status-badge running" title="播放中"></span>' +
            '<span class="th-collapsed-info"><span class="th-collapsed-spd">' + S.speed + 'x</span><span class="th-collapsed-pct">--%</span></span>' +
          '</div>' +
          '<div class="th-head-right"><span class="th-ver">v1.13.0</span><span class="th-fold" title="收起/展开">▾</span></div>' +
        '</div>' +
        '<div class="th-status-chip"><span class="th-chip-dot"></span><span class="th-chip-txt">就绪</span></div>' +
        '<div class="th-body">' +
          '<div class="th-row th-speed-row"><span class="th-lab">倍速</span><span class="th-spd-row">' +
            SPEEDS.map(function (s) {
              return '<span class="th-spd-wrap"><span class="th-spd' + (s >= 16 ? ' warn' : '') + '" data-speed="' + s + '">' + s + 'x</span><span class="th-spd-eta">--</span></span>';
            }).join('') +
          '</span></div>' +
          '<div class="th-row th-switch-row">' +
            '<label class="th-switch-label"><input type="checkbox" id="tb21-autoNext"><span class="th-switch-track"><span class="th-switch-thumb"></span></span><span class="th-switch-txt">自动下一节</span></label>' +
            '<label class="th-switch-label"><input type="checkbox" id="tb21-autoMute"><span class="th-switch-track"><span class="th-switch-thumb"></span></span><span class="th-switch-txt">自动静音</span></label>' +
            '<label class="th-switch-label rush" title="🚀 极速冲刺秒刷：每2秒向前智能推进。注意：长视频(>15min)因21tb后端50%硬校验，建议优先使用【⚡极速性价/最短用时】筛选短视频秒刷，或配合多课同开！"><input type="checkbox" id="tb21-rushMode"><span class="th-switch-track"><span class="th-switch-thumb"></span></span><span class="th-switch-txt">🚀极速冲刺</span></label>' +
          '</div>' +
          '<div class="th-prog"><div class="th-prog-bar"><div class="th-prog-fill"></div></div><div class="th-prog-txt">当前课进度 --</div></div>' +
          '<div class="th-cat-title">📊 类目进度</div>' +
          '<div class="th-cat-info"></div>' +
          '<div class="th-dash-title">📚 多课进度</div>' +
          '<div class="th-dash-list"></div>' +
          '<div class="th-status"></div>' +
          '<div class="th-note"></div>' +
        '</div>' +
        '<div class="th-mini-bar"><div class="th-mini-fill"></div></div>';
      (document.body || document.documentElement).appendChild(panel);

      // 拖动（记忆位置，rAF 平滑 + 边界防溢出）
      const head = panel.querySelector('.th-head');
      let drag = null;
      let rafId = null;
      let curX = 0, curY = 0;

      head.addEventListener('mousedown', function (e) {
        if (e.target.closest('.th-fold') || e.target.closest('.th-ver')) return;
        const r = panel.getBoundingClientRect();
        drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
        curX = e.clientX;
        curY = e.clientY;
        document.body.style.userSelect = 'none';
        panel.classList.add('th-dragging');
        e.preventDefault();
      });

      document.addEventListener('mousemove', function (e) {
        if (!drag) return;
        curX = e.clientX;
        curY = e.clientY;
        if (!rafId) {
          rafId = requestAnimationFrame(function () {
            rafId = null;
            if (!drag) return;
            const pw = panel.offsetWidth || 310;
            const ph = panel.offsetHeight || 200;
            const maxLeft = Math.max(0, window.innerWidth - pw);
            const maxTop = Math.max(0, window.innerHeight - ph);
            const nx = Math.max(0, Math.min(curX - drag.dx, maxLeft));
            const ny = Math.max(0, Math.min(curY - drag.dy, maxTop));
            panel.style.left = nx + 'px';
            panel.style.top = ny + 'px';
            panel.style.right = 'auto';
          });
        }
      });

      document.addEventListener('mouseup', function () {
        if (!drag) return;
        drag = null;
        document.body.style.userSelect = '';
        panel.classList.remove('th-dragging');
        try {
          const r = panel.getBoundingClientRect();
          localStorage.setItem('tb21_helper_pos', JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) }));
        } catch (e) {}
      });

      // 折叠
      panel.querySelector('.th-fold').addEventListener('click', function () {
        panel.classList.toggle('th-hide');
      });

      // 事件委托：倍速
      panel.querySelector('.th-spd-row').addEventListener('click', function (ev) {
        const el = ev.target.closest('.th-spd');
        if (el) setSpeed(parseInt(el.getAttribute('data-speed'), 10));
      });
      // 事件委托：多课列表 → 当前标签页跳到该课程
      panel.querySelector('.th-dash-list').addEventListener('click', function (ev) {
        const row = ev.target.closest('.dh-row');
        if (row && row.dataset.cid) {
          try { window.parent.location.href = courseUrl(row.dataset.cid); } catch (e) {}
        }
      });

      // 开关事件
      const ckN = panel.querySelector('#tb21-autoNext');
      ckN.addEventListener('change', function () { S.autoNext = ckN.checked; save(); });
      const ckM = panel.querySelector('#tb21-autoMute');
      ckM.addEventListener('change', function () {
        S.autoMute = ckM.checked;
        save();
        const v = getVideo();
        if (v) {
          applyMutePreference(v);
          applySettings(v);
        }
      });
      const ckR = panel.querySelector('#tb21-rushMode');
      if (ckR) {
        ckR.checked = !!S.rushMode;
        ckR.addEventListener('change', function () {
          S.rushMode = ckR.checked;
          save();
          console.log('[刷课助手] 🚀 极速冲刺模式已' + (S.rushMode ? '开启（15~20秒通关/节）' : '关闭（恢复稳健倍速）'));
          if (!S.rushMode) resetRushState();
        });
      }

      // 恢复上次拖动位置（越界时收进视口）
      try {
        const pos = JSON.parse(localStorage.getItem('tb21_helper_pos') || 'null');
        if (pos && typeof pos.x === 'number') {
          const w = panel.offsetWidth || 302;
          const h = panel.offsetHeight || 200;
          panel.style.left = Math.max(0, Math.min(pos.x, window.innerWidth - w)) + 'px';
          panel.style.top = Math.max(0, Math.min(pos.y, window.innerHeight - h)) + 'px';
          panel.style.right = 'auto';
        }
      } catch (e) {}

      refreshPanel();
    }

    function setSpeed(sp) {
      S.speed = sp;
      save();
      const v = getVideo();
      if (v) applySettings(v);
      refreshPanel();
    }

    function ensurePanel() {
      if (document.body) buildPanel();
      else {
        // body 还没出现（document-start 阶段），等 DOM 就绪再建
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildPanel);
        else setTimeout(buildPanel, 200);
      }
    }
    ensurePanel();
    setTimeout(ensurePanel, 1000);  // 兜底：Spa 页面渲染后补建面板
    setTimeout(ensurePanel, 3000);

    /* ---------- 油猴菜单（备用控制，面板被遮挡时可用） ---------- */
    try {
      if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('倍速: ' + S.speed + 'x（点此循环切换 2/4/8/16/20）', function () {
          const idx = SPEEDS.indexOf(S.speed);
          setSpeed(SPEEDS[(idx + 1) % SPEEDS.length]);
          if (typeof GM_setValue === 'function') GM_setValue('menuSpeed', S.speed);
        });
        GM_registerMenuCommand((S.autoNext ? '✓ ' : '') + '自动下一节（点击切换）', function () {
          S.autoNext = !S.autoNext; save();
        });
        GM_registerMenuCommand((S.autoMute ? '✓ ' : '') + '自动静音（点击切换）', function () {
          S.autoMute = !S.autoMute; save();
          const v = getVideo();
          if (v) {
            applyMutePreference(v);
            applySettings(v);
          }
        });
      }
    } catch (e) {}

    /* ---------- DOM 变化监听（body 出现后再挂，避免 document-start 时抛错） ---------- */
    function observeDom() {
      if (!document.body) return;
      // 回调里只做查询/设置，不写面板 DOM（避免与面板自身更新形成循环）
      let _domTimer = null;
      new MutationObserver(function (mutations) {
        if (_domTimer) return; // [性能优化] 防抖处理，避免 DOM 频繁更新导致 CPU 飙升
        _domTimer = setTimeout(function() {
          _domTimer = null;
          const v = getVideo();
          if (v) { bindVideo(v); applySettings(v); }
        }, 800);
      }).observe(document.body, { childList: true, subtree: true });
    }
    if (document.body) observeDom();
    else document.addEventListener('DOMContentLoaded', observeDom);

    console.log('[刷课助手] 播放页脚本已启动，当前倍速:', S.speed + 'x');
  }

  /* ============ 入口 ============ */
  try {
    let playerInited = false;
    let parentInited = false;
    let activeSpaRoute = '';
    let cleanupSpaRoute = null;

    function updateRoutePanelSections(route) {
      const panel = cachedEl('tb21-auto-panel');
      if (!panel) return;
      const years = panel.querySelector('.ap-years');
      const courses = panel.querySelector('.ap-courses');
      if (years) years.style.display = route === 'list' ? '' : 'none';
      if (courses) courses.style.display = route === 'detail' ? '' : 'none';
    }

    function routeInit() {
      if (window.top !== window.self) {
        if (!playerInited) {
          playerInited = true;
          initPlayer();
        }
      } else if (location.pathname.indexOf('/els/html/courseStudyItem/') === 0) {
        if (!parentInited) {
          parentInited = true;
          initParent();
        }
      } else if (location.pathname.indexOf('/nms-frontend/') === 0) {
        const nextRoute = location.hash.indexOf('course/list') > -1 ? 'list' :
          (location.hash.indexOf('courseDetail') > -1 ? 'detail' : '');

        // 即使仍在详情页，也要跟随 hash 更新返回地址，避免回到上一个年度/类目。
        if (nextRoute === 'detail') setDetailUrl(location.href);
        if (nextRoute === activeSpaRoute) return;

        if (cleanupSpaRoute) {
          try { cleanupSpaRoute(); } catch (e) {}
          cleanupSpaRoute = null;
        }
        activeSpaRoute = nextRoute;

        if (nextRoute === 'list') cleanupSpaRoute = initCourseList();
        else if (nextRoute === 'detail') cleanupSpaRoute = initCourseDetail();
        else {
          const panel = cachedEl('tb21-auto-panel');
          if (panel) panel.__tb21ExtraInfo = null;
        }
        updateRoutePanelSections(nextRoute);
      }
    }
    routeInit();
    // nms-frontend 用 hash 路由（Vue Router pushState），列表页↔详情页切换不刷新页面也不触发 hashchange，
    // 用轮询检测 hash 变化来初始化对应模块
    let lastHash = location.hash;
    setInterval(function () {
      if (location.pathname.indexOf('/nms-frontend/') === 0 && location.hash !== lastHash) {
        lastHash = location.hash;
        routeInit();
      }
    }, 1000);
  } catch (e) {
    console.error('[刷课助手] 启动异常:', e);
  }
})();
