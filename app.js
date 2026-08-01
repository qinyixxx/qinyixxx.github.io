(() => {
  "use strict";

  const API_BASE_URL = String(window.APP_CONFIG?.API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
  const TOKEN_KEY = "personalCardAdminToken";
  const state = { works: [], blogs: [], comments: [], isAdmin: false };
  const elements = {
    avatarWrapper: document.querySelector("#avatarWrapper"),
    avatarInput: document.querySelector("#avatarInput"),
    avatarImage: document.querySelector("#avatarImage"),
    avatarPlaceholder: document.querySelector("#avatarPlaceholder"),
    bio: document.querySelector("#bioContent"),
    worksGrid: document.querySelector("#worksGrid"),
    blogsGrid: document.querySelector("#blogGrid"),
    commentsList: document.querySelector("#commentsList"),
    addWork: document.querySelector("#addWorkBtn"),
    addBlog: document.querySelector("#addBlogBtn"),
    search: document.querySelector("#searchInput"),
    commentForm: document.querySelector("#commentForm"),
    guestName: document.querySelector("#guestName"),
    guestMessage: document.querySelector("#guestMessage"),
    submitComment: document.querySelector("#submitComment"),
    status: document.querySelector("#connectionStatus"),
    toast: document.querySelector("#toast"),
    loginButton: document.querySelector("#loginButton"),
    logoutButton: document.querySelector("#logoutButton"),
    loginDialog: document.querySelector("#loginDialog"),
    loginForm: document.querySelector("#loginForm"),
    closeLoginButton: document.querySelector("#closeLoginButton"),
    loginSubmit: document.querySelector("#loginSubmit"),
    adminUsername: document.querySelector("#adminUsername"),
    adminPassword: document.querySelector("#adminPassword")
  };

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function assetUrl(path = "") {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  function showToast(message, duration = 2600) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => elements.toast.classList.remove("show"), duration);
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token && options.auth !== false) headers.set("Authorization", `Bearer ${token}`);
    if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    let response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    } catch (error) {
      throw new Error(`无法连接后端（${API_BASE_URL || "当前域名"}）`);
    }

    if (response.status === 204) return null;
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
      const detail = typeof data === "object" ? data.detail : data;
      if (response.status === 401 && path !== "/api/auth/login" && options.auth !== false) {
        sessionStorage.removeItem(TOKEN_KEY);
        setAdminMode(false);
      }
      throw new Error(detail || `请求失败（${response.status}）`);
    }
    return data;
  }

  async function withFeedback(action, successMessage) {
    try {
      const result = await action();
      if (successMessage) showToast(successMessage);
      return result;
    } catch (error) {
      console.error(error);
      showToast(`⚠️ ${error.message}`, 4200);
      throw error;
    }
  }

  function setAvatar(url) {
    if (url) {
      elements.avatarImage.src = assetUrl(url);
      elements.avatarImage.hidden = false;
      elements.avatarPlaceholder.hidden = true;
    } else {
      elements.avatarImage.removeAttribute("src");
      elements.avatarImage.hidden = true;
      elements.avatarPlaceholder.hidden = false;
    }
  }

  function setAdminMode(isAdmin) {
    state.isAdmin = isAdmin;
    document.body.classList.toggle("is-admin", isAdmin);
    elements.bio.contentEditable = String(isAdmin);
    elements.avatarWrapper.disabled = !isAdmin;
    elements.avatarWrapper.title = isAdmin ? "点击更换头像" : "管理员登录后可更换头像";
    if (state.works.length) renderWorks();
    if (state.blogs.length) renderBlogs();
  }

  function renderWorks() {
    if (!state.works.length) {
      elements.worksGrid.innerHTML = '<div class="empty-state"><i class="fas fa-plus-circle"></i>点击“添加作品”来创建</div>';
      return;
    }

    elements.worksGrid.innerHTML = state.works.map((item) => `
      <article class="work-card" data-id="${item.id}">
        <button class="image-picker js-pick-image" type="button" aria-label="更换作品图片" ${state.isAdmin ? "" : "disabled"}>
          ${item.image_url
            ? `<img src="${escapeHtml(assetUrl(item.image_url))}" alt="${escapeHtml(item.title)}">`
            : '<span class="image-placeholder"><i class="fas fa-image"></i><span>点击添加图片</span></span>'}
        </button>
        <input class="js-work-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
        <div class="work-info">
          <div class="work-title editable" contenteditable="${state.isAdmin}" data-field="title" role="textbox">${escapeHtml(item.title)}</div>
          <div class="work-desc editable" contenteditable="${state.isAdmin}" data-field="description" role="textbox">${escapeHtml(item.description || "")}</div>
        </div>
        <button class="delete-button js-delete-work admin-only" type="button" title="删除作品" aria-label="删除作品"><i class="fas fa-times"></i></button>
      </article>
    `).join("");
  }

  function filteredBlogs() {
    const keyword = elements.search.value.trim().toLocaleLowerCase("zh-CN");
    if (!keyword) return state.blogs;
    return state.blogs.filter((item) =>
      `${item.title} ${item.summary}`.toLocaleLowerCase("zh-CN").includes(keyword)
    );
  }

  function renderBlogs() {
    const blogs = filteredBlogs();
    if (!blogs.length) {
      elements.blogsGrid.innerHTML = `<div class="empty-state"><i class="fas fa-search"></i>${state.blogs.length ? "没有找到文章" : "点击“添加文章”来创建"}</div>`;
      return;
    }

    elements.blogsGrid.innerHTML = blogs.map((item) => `
      <article class="blog-card" data-id="${item.id}">
        <button class="image-picker js-pick-cover" type="button" aria-label="更换博客封面" ${state.isAdmin ? "" : "disabled"}>
          ${item.cover_url
            ? `<img src="${escapeHtml(assetUrl(item.cover_url))}" alt="${escapeHtml(item.title)}的封面">`
            : '<span class="image-placeholder"><i class="fas fa-image"></i><span>添加封面</span></span>'}
        </button>
        <input class="js-blog-cover" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
        <div class="blog-content">
          <div class="blog-title editable" contenteditable="${state.isAdmin}" data-field="title" role="textbox">${escapeHtml(item.title)}</div>
          <label class="blog-meta"><i class="far fa-calendar-alt"></i><span class="sr-only">发布日期</span><input class="blog-date" type="date" value="${escapeHtml(item.published_date)}" ${state.isAdmin ? "" : "disabled"}></label>
          <div class="blog-summary editable" contenteditable="${state.isAdmin}" data-field="summary" role="textbox">${escapeHtml(item.summary || "")}</div>
        </div>
        <button class="delete-button js-delete-blog admin-only" type="button" title="删除文章" aria-label="删除文章"><i class="fas fa-times"></i></button>
      </article>
    `).join("");
  }

  function renderComments() {
    if (!state.comments.length) {
      elements.commentsList.innerHTML = '<div class="empty-state">还没有留言，来说点什么吧 :)</div>';
      return;
    }

    elements.commentsList.innerHTML = state.comments.map((item) => `
      <article class="comment-item">
        <div class="comment-name">${escapeHtml(item.name || "匿名")}<time>${escapeHtml(item.time || "")}</time></div>
        <div class="comment-text">${escapeHtml(item.message)}</div>
      </article>
    `).join("");
  }

  async function uploadFile(path, file) {
    if (file.size > 8 * 1024 * 1024) throw new Error("图片不能超过 8 MB");
    const body = new FormData();
    body.append("file", file);
    return api(path, { method: "POST", body });
  }

  elements.avatarWrapper.addEventListener("click", () => elements.avatarInput.click());

  elements.loginButton.addEventListener("click", () => {
    elements.loginDialog.showModal();
    requestAnimationFrame(() => elements.adminUsername.focus());
  });

  elements.closeLoginButton.addEventListener("click", () => elements.loginDialog.close());
  elements.loginDialog.addEventListener("click", (event) => {
    if (event.target === elements.loginDialog) elements.loginDialog.close();
  });

  elements.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    elements.loginSubmit.disabled = true;
    try {
      const result = await withFeedback(() => api("/api/auth/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify({
          username: elements.adminUsername.value.trim(),
          password: elements.adminPassword.value
        })
      }), "🔓 已进入管理模式");
      sessionStorage.setItem(TOKEN_KEY, result.access_token);
      elements.adminPassword.value = "";
      elements.loginDialog.close();
      setAdminMode(true);
    } catch (_) {
    } finally {
      elements.loginSubmit.disabled = false;
    }
  });

  elements.logoutButton.addEventListener("click", () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setAdminMode(false);
    showToast("🔒 已退出管理模式");
  });
  elements.avatarInput.addEventListener("change", async () => {
    const file = elements.avatarInput.files?.[0];
    if (!file) return;
    elements.avatarWrapper.disabled = true;
    try {
      const result = await withFeedback(() => uploadFile("/api/profile/avatar", file), "✅ 头像已保存到服务器");
      setAvatar(result.avatar_url);
    } catch (_) {
      // 错误已展示。
    } finally {
      elements.avatarWrapper.disabled = false;
      elements.avatarInput.value = "";
    }
  });

  elements.bio.addEventListener("blur", async () => {
    const bio = elements.bio.innerText.trim();
    if (!bio) return showToast("⚠️ 简介不能为空");
    try {
      await withFeedback(
        () => api("/api/profile", { method: "PATCH", body: JSON.stringify({ bio }) }),
        "✅ 简介已保存"
      );
    } catch (_) {}
  });

  elements.addWork.addEventListener("click", async () => {
    elements.addWork.disabled = true;
    try {
      const item = await withFeedback(
        () => api("/api/works", { method: "POST", body: JSON.stringify({ title: "新作品", description: "描述文字" }) }),
        "➕ 已添加新作品"
      );
      state.works.push(item);
      renderWorks();
    } catch (_) {
    } finally {
      elements.addWork.disabled = false;
    }
  });

  elements.worksGrid.addEventListener("click", async (event) => {
    const card = event.target.closest(".work-card");
    if (!card) return;
    const id = Number(card.dataset.id);

    if (event.target.closest(".js-pick-image")) card.querySelector(".js-work-image").click();
    if (event.target.closest(".js-delete-work")) {
      if (!window.confirm("确定删除这个作品吗？")) return;
      try {
        await withFeedback(() => api(`/api/works/${id}`, { method: "DELETE" }), "🗑️ 作品已删除");
        state.works = state.works.filter((item) => item.id !== id);
        renderWorks();
      } catch (_) {}
    }
  });

  elements.worksGrid.addEventListener("change", async (event) => {
    if (!event.target.matches(".js-work-image")) return;
    const card = event.target.closest(".work-card");
    const id = Number(card.dataset.id);
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await withFeedback(() => uploadFile(`/api/works/${id}/image`, file), "📷 作品图片已保存");
      const item = state.works.find((entry) => entry.id === id);
      if (item) item.image_url = result.image_url;
      renderWorks();
    } catch (_) {}
  });

  elements.worksGrid.addEventListener("focusout", async (event) => {
    if (!event.target.matches(".editable")) return;
    const card = event.target.closest(".work-card");
    const id = Number(card.dataset.id);
    const field = event.target.dataset.field;
    const value = event.target.innerText.trim();
    if (field === "title" && !value) return showToast("⚠️ 标题不能为空");
    try {
      const updated = await withFeedback(() => api(`/api/works/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value })
      }));
      state.works = state.works.map((item) => item.id === id ? updated : item);
    } catch (_) {}
  });

  elements.addBlog.addEventListener("click", async () => {
    elements.addBlog.disabled = true;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const item = await withFeedback(() => api("/api/blogs", {
        method: "POST",
        body: JSON.stringify({ title: "新文章标题", published_date: today, summary: "在这里写下摘要..." })
      }), "📝 已添加新文章");
      state.blogs.unshift(item);
      renderBlogs();
    } catch (_) {
    } finally {
      elements.addBlog.disabled = false;
    }
  });

  elements.search.addEventListener("input", renderBlogs);

  elements.blogsGrid.addEventListener("click", async (event) => {
    const card = event.target.closest(".blog-card");
    if (!card) return;
    const id = Number(card.dataset.id);
    if (event.target.closest(".js-pick-cover")) card.querySelector(".js-blog-cover").click();
    if (event.target.closest(".js-delete-blog")) {
      if (!window.confirm("确定删除这篇文章吗？")) return;
      try {
        await withFeedback(() => api(`/api/blogs/${id}`, { method: "DELETE" }), "🗑️ 文章已删除");
        state.blogs = state.blogs.filter((item) => item.id !== id);
        renderBlogs();
      } catch (_) {}
    }
  });

  elements.blogsGrid.addEventListener("change", async (event) => {
    const card = event.target.closest(".blog-card");
    if (!card) return;
    const id = Number(card.dataset.id);
    if (event.target.matches(".js-blog-cover")) {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const result = await withFeedback(() => uploadFile(`/api/blogs/${id}/cover`, file), "📷 封面已保存");
        const item = state.blogs.find((entry) => entry.id === id);
        if (item) item.cover_url = result.cover_url;
        renderBlogs();
      } catch (_) {}
    }
    if (event.target.matches(".blog-date")) {
      try {
        const updated = await withFeedback(() => api(`/api/blogs/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ published_date: event.target.value })
        }), "✅ 日期已保存");
        state.blogs = state.blogs.map((item) => item.id === id ? updated : item);
      } catch (_) {}
    }
  });

  elements.blogsGrid.addEventListener("focusout", async (event) => {
    if (!event.target.matches(".editable")) return;
    const card = event.target.closest(".blog-card");
    const id = Number(card.dataset.id);
    const field = event.target.dataset.field;
    const value = event.target.innerText.trim();
    if (field === "title" && !value) return showToast("⚠️ 标题不能为空");
    try {
      const updated = await withFeedback(() => api(`/api/blogs/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value })
      }));
      state.blogs = state.blogs.map((item) => item.id === id ? updated : item);
    } catch (_) {}
  });

  elements.commentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = elements.guestMessage.value.trim();
    if (!message) return showToast("⚠️ 请写点留言 :)");
    elements.submitComment.disabled = true;
    try {
      const item = await withFeedback(() => api("/api/comments", {
        method: "POST",
        body: JSON.stringify({ name: elements.guestName.value.trim() || "匿名", message })
      }), "💬 留言已发送！");
      state.comments.unshift(item);
      state.comments = state.comments.slice(0, 50);
      elements.guestName.value = "";
      elements.guestMessage.value = "";
      renderComments();
    } catch (_) {
    } finally {
      elements.submitComment.disabled = false;
    }
  });

  async function initialize() {
    elements.worksGrid.innerHTML = '<div class="empty-state"><i class="fas fa-circle-notch fa-spin"></i>正在加载作品…</div>';
    elements.blogsGrid.innerHTML = '<div class="empty-state"><i class="fas fa-circle-notch fa-spin"></i>正在加载文章…</div>';
    elements.commentsList.innerHTML = '<div class="empty-state"><i class="fas fa-circle-notch fa-spin"></i>正在加载留言…</div>';

    try {
      if (sessionStorage.getItem(TOKEN_KEY)) {
        try {
          await api("/api/auth/me");
          setAdminMode(true);
        } catch (_) {
          sessionStorage.removeItem(TOKEN_KEY);
          setAdminMode(false);
        }
      } else {
        setAdminMode(false);
      }
      const [profile, works, blogs, comments] = await Promise.all([
        api("/api/profile"), api("/api/works"), api("/api/blogs"), api("/api/comments")
      ]);
      elements.bio.textContent = profile.bio;
      setAvatar(profile.avatar_url);
      state.works = works;
      state.blogs = blogs;
      state.comments = comments;
      renderWorks();
      renderBlogs();
      renderComments();
      elements.status.classList.remove("is-error");
      elements.status.innerHTML = '<i class="fas fa-cloud"></i> 数据已连接后端并保存到服务器';
    } catch (error) {
      console.error(error);
      elements.status.classList.add("is-error");
      elements.status.innerHTML = `<i class="fas fa-triangle-exclamation"></i> ${escapeHtml(error.message)}，请检查 config.js 和后端服务`;
      showToast(`⚠️ ${error.message}`, 5000);
    }
  }

  initialize();
})();
