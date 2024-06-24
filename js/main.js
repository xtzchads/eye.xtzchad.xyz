const input = document.getElementById('target-address');
const cache = new Map();
let offset = 0;
let history = [];
let historyIndex = -1;

document.addEventListener('DOMContentLoaded', function() {
    const hash = location.hash.slice(1);
    if (hash) {
        const [address, resultLimitValue, tezLimitValue] = hash.split(',');
        if (address) {
            document.getElementById('target-address').value = address;
        }
        if (resultLimitValue) {
            document.getElementById('result-limit').value = resultLimitValue;
            document.getElementById('limit-value').textContent = resultLimitValue + ' txes';
        }
        if (tezLimitValue) {
            document.getElementById('tez-limit').value = tezLimitValue;
            document.getElementById('limit-tez').textContent = tezLimitValue + ' tez';
        }
        document.getElementById('confirm-button').click();
    }
});

input.addEventListener('keydown', function(event) {
    if (event.keyCode === 13) {
        document.getElementById('confirm-button').click();
    }
});

document.getElementById('confirm-button').addEventListener('click', function() {
    const targetAddress = document.getElementById('target-address').value.trim();
    const limit = document.getElementById('result-limit').value;
    updateLocationHash();
    document.getElementById('sankey-diagram').style.display = 'none';
    document.getElementById('loader').style.display = 'block';
    generateDataAndDrawDiagram(targetAddress, limit);
});

document.getElementById('result-limit').addEventListener('input', function() {
    const limitValue = document.getElementById('result-limit').value;
    document.getElementById('limit-value').textContent = limitValue + ' txes';
    updateLocationHash();
});

document.getElementById('tez-limit').addEventListener('input', function() {
    const limitValue = document.getElementById('tez-limit').value;
    document.getElementById('limit-tez').textContent = limitValue + ' tez';
    updateLocationHash();
});

function updateLocationHash() {
    const tezosAddress = document.getElementById('target-address').value.trim();
    const resultLimitValue = document.getElementById('result-limit').value;
    const tezLimitValue = document.getElementById('tez-limit').value;
    location.hash = `${tezosAddress},${resultLimitValue},${tezLimitValue}`;
}

async function fetchData(tezosAddress) {
    try {
        let str;
        if (offset === 0) {
            str = `https://api.tzkt.io/v1/accounts/${tezosAddress}/operations?sort.desc=level&type=transaction&limit=1000`;
        } else {
            str = `https://api.tzkt.io/v1/accounts/${tezosAddress}/operations?sort.desc=level&type=transaction&limit=1000&lastId=${offset}`;
        }
        const response = await fetch(str);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        offset = data[data.length - 1].id;
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

async function fetchAllData(tezosAddress, limit) {
    if (cache.has(tezosAddress)) {
        const cached = cache.get(tezosAddress);
        if (cached.limit === limit) {
            return cached.data;
        }
    }

    let allData = [];
    let counter = 0;
    while (offset >= 0 && counter < limit) {
        const data = await fetchData(tezosAddress);
        if (!data || !Array.isArray(data) || data.length === 0) {
            break;
        }
        allData.push(...data);
        counter += 1000;
    }

    cache.set(tezosAddress, { data: allData, limit: limit });
    return allData;
}


function parseTransactions(data, tezosAddress) {
    const inflowsMap = new Map();
    const outflowsMap = new Map();
    const addressToAliasMap = new Map();

    if (!data || !Array.isArray(data)) {
        console.error('Invalid data format');
        return { inflows: [], outflows: [], addressToAliasMap: new Map() };
    }

    data.forEach(operation => {
        let senderAlias = operation.sender.address;
        let targetAlias = operation.target.address;

        if (operation.sender.alias) {
            senderAlias = operation.sender.alias;
        }
        if (operation.target.alias) {
            targetAlias = operation.target.alias;
        }

        addressToAliasMap.set(operation.sender.address, senderAlias);
        addressToAliasMap.set(operation.target.address, targetAlias);

        if (operation.sender && operation.target && operation.sender.address === tezosAddress && operation.amount !== "0") {
            const targetAddress = targetAlias;
            const amount = operation.amount / 1000000;
            if (outflowsMap.has(targetAddress)) {
                outflowsMap.set(targetAddress, outflowsMap.get(targetAddress) + amount);
            } else {
                outflowsMap.set(targetAddress, amount);
            }
        }
        if (operation.target && operation.target.address === tezosAddress && operation.sender.address !== tezosAddress) {
            const senderAddress = senderAlias;
            const amount = operation.amount / 1000000;
            if (inflowsMap.has(senderAddress)) {
                inflowsMap.set(senderAddress, inflowsMap.get(senderAddress) + amount);
            } else {
                inflowsMap.set(senderAddress, amount);
            }
        }
    });

    const tezLimit = document.getElementById('tez-limit').value;
    const inflows = [...inflowsMap.entries()].map(([address, amount]) => ({ address, amount }))
        .filter(entry => entry.amount >= tezLimit);
    const outflows = [...outflowsMap.entries()].map(([address, amount]) => ({ address, amount }))
        .filter(entry => entry.amount >= tezLimit);
    return { inflows, outflows, addressToAliasMap };
}

async function generateDataAndDrawDiagram(tezosAddress, limit) {
    const data = await fetchAllData(tezosAddress, limit);
    if (!data) {
        hideLoader();
        return;
    }
    offset = 0;
    const { inflows, outflows, addressToAliasMap } = parseTransactions(data, tezosAddress);
    hideLoaderAndDrawDiagram();
    drawSankeyDiagram(tezosAddress, inflows, outflows, addressToAliasMap);
    
    if (historyIndex === -1 || history[historyIndex] !== tezosAddress) {
        updateHistory(tezosAddress);
    }
}

function hideLoaderAndDrawDiagram() {
    document.getElementById('sankey-diagram').style.display = 'block';
    document.getElementById('loader').style.display = 'none';
}

function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}

function drawSankeyDiagram(targetAddress, inflows, outflows, addressToAliasMap) {
    const nodes = [
        { label: addressToAliasMap.get(targetAddress) || targetAddress },
        ...inflows.map(entry => ({ label: entry.address })),
        ...outflows.map(entry => ({ label: entry.address }))
    ];

    const links = [
        ...inflows.map(entry => ({
            source: nodes.findIndex(node => node.label === entry.address),
            target: 0,
            value: entry.amount,
            color: 'rgba(144, 238, 144, 0.6)'
        })),
        ...outflows.map(entry => ({
            source: 0,
            target: nodes.findIndex(node => node.label === entry.address),
            value: entry.amount,
            color: 'rgba(255, 99, 71, 0.6)'
        }))
    ];

    const sankeyData = {
        type: "sankey",
        orientation: "h",
        node: {
            pad: 15,
            thickness: 20,
            line: {
                color: "black",
                width: 0.5
            },
            label: nodes.map(node => node.label)
        },
        link: {
            source: links.map(link => link.source),
            target: links.map(link => link.target),
            value: links.map(link => link.value),
            color: links.map(link => link.color)
        }
    };

    const optimalHeight = Math.max(600, nodes.length * 15);

    Plotly.newPlot('sankey-diagram', [sankeyData], {
        margin: { t: 0, r: 0, b: 0, l: 0 },
        width: window.innerWidth,
        height: optimalHeight
    });

    const sankeyContainer = document.getElementById('sankey-diagram');
    sankeyContainer.on('plotly_click', function(event) {
        if (event && event.points && event.points.length > 0) {
            const clickedNodeLabel = event.points[0].source.pointNumber !== 0 ? event.points[0].source.label : event.points[0].target.label;
            const relatedAddress = Array.from(addressToAliasMap).find(([address, alias]) => alias === clickedNodeLabel)?.[0] || clickedNodeLabel;
            document.getElementById('target-address').value = relatedAddress.trim();
            navigator.clipboard.writeText(relatedAddress.trim()).then(function() {
                console.log('Value copied to clipboard:', relatedAddress.trim());
            }).catch(function(err) {
                console.error('Could not copy text:', err);
            });
            document.getElementById('confirm-button').click();
        }
    });
}

document.getElementById('back-button').addEventListener('click', function() {
    if (historyIndex > 0) {
        historyIndex--;
        const previousAddress = history[historyIndex];
        document.getElementById('target-address').value = previousAddress;
        const limit = document.getElementById('result-limit').value;
        updateLocationHash();
        generateDataAndDrawDiagram(previousAddress, limit);
        updateNavigationButtons();
    }
});

document.getElementById('forward-button').addEventListener('click', function() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        const nextAddress = history[historyIndex];
        document.getElementById('target-address').value = nextAddress;
        const limit = document.getElementById('result-limit').value;
        updateLocationHash();
        generateDataAndDrawDiagram(nextAddress, limit);
        updateNavigationButtons();
    }
});

function updateNavigationButtons() {
    document.getElementById('back-button').disabled = historyIndex <= 0;
    document.getElementById('forward-button').disabled = historyIndex >= history.length - 1;
}

const resultLimit = document.getElementById('result-limit');
const tezLimit = document.getElementById('tez-limit');
const resultLimitTooltip = document.getElementById('result-limit-tooltip');
const tezLimitTooltip = document.getElementById('tez-limit-tooltip');

resultLimit.addEventListener('mouseenter', function() {
    resultLimitTooltip.style.display = 'block';
});

resultLimit.addEventListener('mouseleave', function() {
    resultLimitTooltip.style.display = 'none';
});

tezLimit.addEventListener('mouseenter', function() {
    tezLimitTooltip.style.display = 'block';
});

tezLimit.addEventListener('mouseleave', function() {
    tezLimitTooltip.style.display = 'none';
});

function updateHistory(tezosAddress) {
    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }
    history.push(tezosAddress);
    historyIndex = history.length - 1;
    updateNavigationButtons();
}

updateNavigationButtons();
