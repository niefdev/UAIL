let cache;

let setData = (data) => {
    cache = data;
}

let getData = () => {
    return cache;
}

module.exports = { setData, getData };