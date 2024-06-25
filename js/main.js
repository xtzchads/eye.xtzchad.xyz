// Element references
const input = document.getElementById('target-address');
const cache = new Map(); // Cache to store fetched data
let offset = 0; // Offset for pagination
let history = []; // History of visited addresses
let historyIndex = -1; // Index in the history array

// On page load, check the location hash for saved values and populate inputs
document.addEventListener('DOMContentLoaded', function() {
    const hash = location.hash.slice(1); // Get the hash without the leading #
    if (hash) {
        const [address, resultLimitValue, tezLimitValue] = hash.split(','); // Parse the hash
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
        document.getElementById('confirm-button').click(); // Trigger data fetch and diagram generation
    }
});

// Trigger data fetch on Enter key press in the address input field
input.addEventListener('keydown', function(event) {
    if (event.keyCode === 13) {
        document.getElementById('confirm-button').click();
    }
});

// Handle confirm button click to fetch and display data
document.getElementById('confirm-button').addEventListener('click', function() {
    const targetAddress = document.getElementById('target-address').value.trim();
    const limit = document.getElementById('result-limit').value;
    updateLocationHash(); // Update location hash
    generateDataAndDrawDiagram(targetAddress, limit); // Fetch data and draw diagram
});

// Update limit display and location hash on input change
document.getElementById('result-limit').addEventListener('input', function() {
    const limitValue = document.getElementById('result-limit').value;
    document.getElementById('limit-value').textContent = limitValue + ' txes';
    updateLocationHash();
});

// Update tez limit display and location hash on input change
document.getElementById('tez-limit').addEventListener('input', function() {
    const limitValue = document.getElementById('tez-limit').value;
    document.getElementById('limit-tez').textContent = limitValue + ' tez';
    updateLocationHash();
});

// Update the location hash with current input values
function updateLocationHash() {
    const tezosAddress = document.getElementById('target-address').value.trim();
    const resultLimitValue = document.getElementById('result-limit').value;
    const tezLimitValue = document.getElementById('tez-limit').value;
    location.hash = `${tezosAddress},${resultLimitValue},${tezLimitValue}`;
}

// Fetch data from API with pagination and cache check
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

// Fetch all data, respecting cache and limit
async function fetchAllData(tezosAddress, limit) {
    if (cache.has(tezosAddress)) {
        const cached = cache.get(tezosAddress);
        if (cached.limit === limit) {
            return cached.data;
        }
    }

    let allData = [];
    let counter = 0;
    document.getElementById('sankey-diagram').style.display = 'none';
    document.getElementById('loader').style.display = 'block';
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

// Parse transaction data into inflows, outflows, and aliases
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

// Generate data, draw diagram, and manage history
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

// Hide loader and show diagram
function hideLoaderAndDrawDiagram() {
    document.getElementById('sankey-diagram').style.display = 'block';
    document.getElementById('loader').style.display = 'none';
}

// Hide loader
function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}

// Draw the Sankey diagram using Plotly
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

    // Handle node click in the Sankey diagram
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
    sankeyContainer.on('plotly_clickannotation', function(event) {
    if (event && event.points && event.points.length > 0) {
        const point = event.points[0];
        const clickedNodeLabel = point.text;
        navigator.clipboard.writeText(clickedNodeLabel.trim()).then(function() {
                console.log('Value copied to clipboard:', relatedAddress.trim());
            }).catch(function(err) {
                console.error('Could not copy text:', err);
            });
    }
    });
}

// Handle back button click to navigate to previous address
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

// Handle forward button click to navigate to next address
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

// Update navigation button states
function updateNavigationButtons() {
    document.getElementById('back-button').disabled = historyIndex <= 0;
    document.getElementById('forward-button').disabled = historyIndex >= history.length - 1;
}

// Tooltips for input fields
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

// Update history with the new address
function updateHistory(tezosAddress) {
    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }
    history.push(tezosAddress);
    historyIndex = history.length - 1;
    updateNavigationButtons();
}

updateNavigationButtons(); // Initial call to set the state of navigation buttons
