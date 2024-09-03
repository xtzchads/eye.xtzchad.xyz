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
            str = `https://api.tzkt.io/v1/accounts/${tezosAddress}/operations?sort.desc=level&type=activation,transaction,origination,migration&limit=1000&status=applied`;
        } else {
            str = `https://api.tzkt.io/v1/accounts/${tezosAddress}/operations?sort.desc=level&type=activation,transaction,origination,migration&limit=1000&status=applied&lastId=${offset}`;
        }
        const response = await fetch(str);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        offset = data[data.length - 1].id;
        return data;
    } catch (error) {
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
    const addressTxCount = new Map();
    const addressDateRange = new Map();
    const txHashesMap = new Map();

    if (!data || !Array.isArray(data)) {
        console.error('Invalid data format');
        return { inflows: [], outflows: [], addressToAliasMap: new Map(), txHashesMap: new Map() };
    }

    data.forEach(operation => {
        let senderAlias = operation.sender?.address || '';
        let targetAlias = operation.target?.address || '';

        if (operation.sender?.alias) {
            senderAlias = operation.sender.alias;
        }
        if (operation.target?.alias) {
            targetAlias = operation.target.alias;
        }

        if (operation.type === 'activation') {
            if (operation.account?.alias) {
                targetAlias = operation.account.alias;
            }
            addressToAliasMap.set(operation.account.address, targetAlias);
            const address = "~Activation~";
            const amount = parseFloat(operation.balance / 1000000);  // Use operation.balance instead of operation.account.balance
            inflowsMap.set(address, amount);
            addressTxCount.set(address, 1);
            const dateRange = { start: new Date(operation.timestamp), end: new Date(operation.timestamp) };
            addressDateRange.set(address, dateRange);
            txHashesMap.set(address, (txHashesMap.get(address) || []).concat(operation.hash));
        } else if (operation.type === 'migration' && operation.kind === 'bootstrap') {
            if (operation.account?.alias) {
                targetAlias = operation.account.alias;
            }
            addressToAliasMap.set(operation.account.address, targetAlias);
            const address = "~Bootstrap~";
            const amount = parseFloat(operation.balanceChange / 1000000);  // Use operation.balance instead of operation.account.balance
            inflowsMap.set(address, amount);
            addressTxCount.set(address, 1);
            const dateRange = { start: new Date(operation.timestamp), end: new Date(operation.timestamp) };
            addressDateRange.set(address, dateRange);
            txHashesMap.set(address, (txHashesMap.get(address) || []).concat(operation.hash));
	} else if (operation.type === 'migration' && operation.kind === 'subsidy') {
            if (operation.account?.alias) {
                targetAlias = operation.account.alias;
            }
            addressToAliasMap.set(operation.account.address, targetAlias);
            const address = "~Subsidy~";
            const amount = parseFloat(operation.balanceChange / 1000000);  // Use operation.balance instead of operation.account.balance
	    if (inflowsMap.has(address)) {
                intflowsMap.set(address, inflowsMap.get(address) + amount);
	    else
                inflowsMap.set(address, amount);
            addressTxCount.set(address, 1);
            const dateRange = { start: new Date(operation.timestamp), end: new Date(operation.timestamp) };
            addressDateRange.set(address, dateRange);
            txHashesMap.set(address, (txHashesMap.get(address) || []).concat(operation.hash));
        } else if (operation.type === 'origination') {
            const timestamp = new Date(operation.timestamp);
            if (operation.contractBalance > 0)
                if (operation.sender.address == tezosAddress) {
                    if (operation.originatedContract?.alias) {
                        targetAlias = operation.originatedContract.alias;
                    }
                    else
                        targetAlias = operation.originatedContract.address;
                    addressToAliasMap.set(operation.sender.address, senderAlias);
                    addressToAliasMap.set(operation.originatedContract.address, targetAlias);
                    const targetAddress = targetAlias;
                    const amount = parseFloat(operation.contractBalance / 1000000);
                    if (outflowsMap.has(targetAddress)) {
                        outflowsMap.set(targetAddress, outflowsMap.get(targetAddress) + amount);
                        addressTxCount.set(targetAddress, addressTxCount.get(targetAddress) + 1);
                        const dateRange = addressDateRange.get(targetAddress);
                        addressDateRange.set(targetAddress, {
                            start: new Date(timestamp),
                            end: dateRange.end
                        });
                        txHashesMap.get(targetAddress).push(operation.hash);
                    } else {
                        outflowsMap.set(targetAddress, amount);
                        addressTxCount.set(targetAddress, 1);
                        addressDateRange.set(targetAddress, { start: timestamp, end: timestamp });
                        txHashesMap.set(targetAddress, [operation.hash]);
                    }
					
                } 
                else if (operation.originatedContract.address==tezosAddress) {
                    if (operation.originatedContract?.alias) {
                        targetAlias = operation.originatedContract.alias;
                    }
                    else
                        targetAlias = operation.originatedContract.address;
                    addressToAliasMap.set(operation.sender.address, senderAlias);
                    addressToAliasMap.set(operation.originatedContract.address, targetAlias);
                    const senderAddress = senderAlias;
                    const amount = parseFloat(operation.contractBalance / 1000000);
                    if (inflowsMap.has(senderAddress)) {
                        inflowsMap.set(senderAddress, inflowsMap.get(senderAddress) + amount);
                        addressTxCount.set(senderAddress, addressTxCount.get(senderAddress) + 1);
                        const dateRange = addressDateRange.get(senderAddress);
                        addressDateRange.set(senderAddress, {
                            start: new Date(timestamp),
                            end: dateRange.end
                        });
                        txHashesMap.get(senderAddress).push(operation.hash);
                    } else {
                        inflowsMap.set(senderAddress, amount);
                        addressTxCount.set(senderAddress, 1);
                        addressDateRange.set(senderAddress, { start: timestamp, end: timestamp });
                        txHashesMap.set(senderAddress, [operation.hash]);
                    }
                }
        } else if (operation.type === 'transaction'){
            addressToAliasMap.set(operation.sender.address, senderAlias);
            addressToAliasMap.set(operation.target.address, targetAlias);

            const timestamp = new Date(operation.timestamp);

            if (operation.sender && operation.target && operation.sender.address === tezosAddress && operation.amount != 0) {
                const targetAddress = targetAlias;
                const amount = parseFloat(operation.amount / 1000000);

                if (outflowsMap.has(targetAddress)) {
                    outflowsMap.set(targetAddress, outflowsMap.get(targetAddress) + amount);
                    addressTxCount.set(targetAddress, addressTxCount.get(targetAddress) + 1);
                    const dateRange = addressDateRange.get(targetAddress);
                    addressDateRange.set(targetAddress, {
                        start: new Date(timestamp),
                        end: dateRange.end
                    });
                    txHashesMap.get(targetAddress).push(operation.hash);
                } else {
                    outflowsMap.set(targetAddress, amount);
                    addressTxCount.set(targetAddress, 1);
                    addressDateRange.set(targetAddress, { start: timestamp, end: timestamp });
                    txHashesMap.set(targetAddress, [operation.hash]);
                }
            }
            if (operation.target && operation.target.address === tezosAddress && operation.sender.address !== tezosAddress && operation.amount != 0) {
                const senderAddress = senderAlias;
                const amount = parseFloat(operation.amount / 1000000);

                if (inflowsMap.has(senderAddress)) {
                    inflowsMap.set(senderAddress, inflowsMap.get(senderAddress) + amount);
                    addressTxCount.set(senderAddress, addressTxCount.get(senderAddress) + 1);
                    const dateRange = addressDateRange.get(senderAddress);
                    addressDateRange.set(senderAddress, {
                        start: new Date(timestamp),
                        end: dateRange.end
                    });
                    txHashesMap.get(senderAddress).push(operation.hash);
                } else {
                    inflowsMap.set(senderAddress, amount);
                    addressTxCount.set(senderAddress, 1);
                    addressDateRange.set(senderAddress, { start: timestamp, end: timestamp });
                    txHashesMap.set(senderAddress, [operation.hash]);
                }
            }
        }
    });

    const tezLimit = document.getElementById('tez-limit').value;
    const inflows = [...inflowsMap.entries()].map(([address, amount]) => ({
        address,
        amount,
        count: addressTxCount.get(address),
        dateRange: addressDateRange.get(address),
        txHashes: txHashesMap.get(address)
    })).filter(entry => entry.amount >= tezLimit);
    const outflows = [...outflowsMap.entries()].map(([address, amount]) => ({
        address,
        amount,
        count: addressTxCount.get(address),
        dateRange: addressDateRange.get(address),
        txHashes: txHashesMap.get(address)
    })).filter(entry => entry.amount >= tezLimit);

    return { inflows, outflows, addressToAliasMap, txHashesMap };
}

// Generate data, draw diagram, and manage history
async function generateDataAndDrawDiagram(tezosAddress, limit) {
    const data = await fetchAllData(tezosAddress, limit);
    if (!data || data.length == 0) {
        hideLoader();
        return;
    }
    offset = 0;
    const { inflows, outflows, addressToAliasMap, txHashesMap } = parseTransactions(data, tezosAddress);
    hideLoaderAndDrawDiagram();
    drawSankeyDiagram(tezosAddress, inflows, outflows, addressToAliasMap, txHashesMap);

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

function drawSankeyDiagram(targetAddress, inflows, outflows, addressToAliasMap, txHashesMap) {
    const numInflows = inflows.length;
    const amInflows = [...inflows.values()].reduce((sum, { amount = 0 }) => sum + amount, 0);
    const numOutflows = outflows.length;
    const amOutflows = [...outflows.values()].reduce((sum, { amount = 0 }) => sum + amount, 0);
    console.log("inputs:" + numInflows + "; outputs:" + numOutflows + "\r\nin:" + amInflows.toFixed(2) + "; out:" + amOutflows.toFixed(2))
    const nodes = [
        {
            label: `${addressToAliasMap.get(targetAddress) || targetAddress}`,
            hoverText: `${addressToAliasMap.get(targetAddress) || targetAddress}<br>Inputs: ${numInflows}<br>Outputs: ${numOutflows}<br>Total in: ${amInflows.toFixed(2)} tez<br>Total out: ${amOutflows.toFixed(2)} tez`
        },
        ...inflows.map(entry => ({
            label: `${entry.address}`,
            hoverText: `${entry.address}<br>${entry.count} txes<br>${entry.dateRange.start.toISOString().split('T')[0]} - ${entry.dateRange.end.toISOString().split('T')[0]}`
        })),
        ...outflows.map(entry => ({
            label: `${entry.address}`,
            hoverText: `${entry.address}<br>${entry.count} txes<br>${entry.dateRange.start.toISOString().split('T')[0]} - ${entry.dateRange.end.toISOString().split('T')[0]}`
        }))
    ];

    const links = [
        ...inflows.map(entry => ({
            source: nodes.findIndex(node => node.label === entry.address),
            target: 0,
            value: entry.amount,
            color: (entry.address === "~Activation~" || entry.address === "~Bootstrap~" || entry.address === "~Subsidy~") ? 'rgba(255, 255, 153, 0.6)' : 'rgba(144, 238, 144, 0.6)' // Light yellow for activation
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
            label: nodes.map(node => node.label),
            customdata: nodes.map(node => node.hoverText),
            hovertemplate: '%{customdata}<extra></extra>'
        },
        link: {
            source: links.map(link => link.source),
            target: links.map(link => link.target),
            value: links.map(link => link.value),
            color: links.map(link => link.color)
        }
    };

    const optimalHeight = Math.max(600, nodes.length * 18);

    Plotly.newPlot('sankey-diagram', [sankeyData], {
        margin: { t: 30, r: 10, b: 10, l: 10 },

        autosize: true,
        height: optimalHeight
    }, { responsive: true, suppressWarnings: true });

    // Handle node click in the Sankey diagram
    const sankeyContainer = document.getElementById('sankey-diagram');
    sankeyContainer.on('plotly_click', function(event) {
        if (event && event.points && event.points.length > 0) {
            const clickedNodeLabel = event.points[0].source.pointNumber !== 0 ? event.points[0].source.label : event.points[0].target.label;
            const relatedAddress = Array.from(addressToAliasMap).find(([address, alias]) => alias === clickedNodeLabel)?.[0] || clickedNodeLabel;
            const txHashes = txHashesMap.get(clickedNodeLabel) || [];
            const txHashesText = txHashes.map(hash => `https://tzkt.io/${hash}`).join('\n');
            const clipboardText = `${relatedAddress}\n\n${txHashesText}`;
            navigator.clipboard.writeText(clipboardText).then(function() {
                console.log(clipboardText);
            }).catch(function(err) {
                console.error('Could not copy text:', err);
            });
            showNotification();
            if (relatedAddress !== "~Activation~" && relatedAddress !== "~Bootstrap~" && relatedAddress !== "~Subsidy~") {
                document.getElementById('target-address').value = relatedAddress.trim();
                document.getElementById('confirm-button').click();
            }
        }
    });
}

function showNotification() {
    const notification = document.getElementById('notification');
    notification.style.display = 'block';
    setTimeout(() => {
        notification.style.opacity = 1;
    }, 10); // Short delay to trigger CSS transition

    setTimeout(() => {
        notification.style.opacity = 0;
        setTimeout(() => {
            notification.style.display = 'none';
        }, 500); // Wait for the fade-out transition to complete
    }, 3000); // Show notification for 3 seconds
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
