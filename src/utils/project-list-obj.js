function ProjectList() {
    this.head = null;
    this.tail = null;
    this.data = {};
}

function Category() {
    this.itemHead = null;
    this.items = {};
    this.perv = null;
    this.next = null;
}

function ProjectItem(perv = null, next = null) {
    this.perv = perv;
    this.next = next;
}

function createNewProjectListObj() {
    // obj.data[head] is the most recently used category
    return new ProjectList();
}

function createNewCategoryObj() {
    // obj.items[itemHead] is the most recently used project
    return new Category();
}

/**
 * @param {String} perv 
 * @param {String} next 
 */
function createNewItemObj(perv = null, next = null) {
    return new ProjectItem(perv, next);
}

/**
 * @param {Object} categoryObj 
 * @param {String} item 
 */
function bringItemToCategoryHead(categoryObj, item) {
    if (categoryObj.itemHead === item) {
        return;
    } else {
        // 将元素摘出链表
        let perv = categoryObj.items[item].perv;
        let next = categoryObj.items[item].next;
        if (perv != null) categoryObj.items[perv].next = next;
        if (next != null) categoryObj.items[next].perv = perv;

        // 更新元素中包含的前后指针
        categoryObj.items[item].perv = null;
        categoryObj.items[item].next = categoryObj.itemHead;

        // 将元素插入到链表头部
        if (categoryObj.itemHead != null) categoryObj.items[categoryObj.itemHead].perv = item;
        categoryObj.itemHead = item;
        return;
    }
}

/**
 * @param {Object} projectListObj 
 * @param {String} category 
 */
function bringCategoryToHead(projectListObj, category) {
    if (projectListObj.head === category) {
        return;
    } else {
        // 将元素摘出链表
        let perv = projectListObj.data[category].perv;
        let next = projectListObj.data[category].next;
        if (perv != null) projectListObj.data[perv].next = next;
        if (next != null) projectListObj.data[next].perv = perv;
        if (projectListObj.tail === category) projectListObj.tail = perv;

        // 更新元素中包含的前后指针
        projectListObj.data[category].perv = null;
        projectListObj.data[category].next = projectListObj.head;

        // 将元素插入到链表头部
        if (projectListObj.head != null) projectListObj.data[projectListObj.head].perv = category;
        projectListObj.head = category;
        if (projectListObj.tail == null) projectListObj.tail = category;
        return;
    }
}

/**
 * @param {Object} projectListObj 
 * @param {String} category 
 */
function addCategoryToTail(projectListObj, category) {
    if (projectListObj.tail === category) {
        return;
    } else {
        projectListObj.data[category].perv = projectListObj.tail;
        projectListObj.data[category].next = null;
        if (projectListObj.head == null) projectListObj.head = category;
        if (projectListObj.tail != null) projectListObj.data[projectListObj.tail].next = category;
        projectListObj.tail = category;
        return;
    }
}

module.exports = {
    createNewProjectListObj,
    createNewCategoryObj,
    createNewItemObj,
    bringItemToCategoryHead,
    bringCategoryToHead,
    addCategoryToTail
};