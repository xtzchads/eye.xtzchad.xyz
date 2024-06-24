async function fetchData(tezosAddress, limit = 1000, offset = 0) {
    try {
        const response = await fetch(`https://api.tzkt.io/v1/accounts/${tezosAddress}/operations?sort.desc=level&type=transaction&limit=1000&offset=${offset}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

async function fetchAllData(tezosAddress, limit = 1000) {
    let offset = 0;
    let allData = [];

    while (offset < limit) {
        const data = await fetchData(tezosAddress, limit, offset);
        if (!data || !Array.isArray(data) || data.length === 0) {
            break;
        }
        allData.push(...data);
        offset += 1000;
    }

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
            const amount = parseFloat(operation.amount / 1000000);
            if (outflowsMap.has(targetAddress)) {
                outflowsMap.set(targetAddress, outflowsMap.get(targetAddress) + amount);
            } else {
                outflowsMap.set(targetAddress, amount);
            }
        }
        if (operation.target && operation.target.address === tezosAddress && operation.sender.address !== tezosAddress) {
            const senderAddress = senderAlias;
            const amount = parseFloat(operation.amount / 1000000);
            if (inflowsMap.has(senderAddress)) {
                inflowsMap.set(senderAddress, inflowsMap.get(senderAddress) + amount);
            } else {
                inflowsMap.set(senderAddress, amount);
            }
        }
    });

    const inflows = [...inflowsMap.entries()].map(([address, amount]) => ({ address, amount }));
    const outflows = [...outflowsMap.entries()].map(([address, amount]) => ({ address, amount }));

    return { inflows, outflows, addressToAliasMap };
}

async function generateDataAndDrawDiagram(tezosAddress, limit) {
    const data = await fetchAllData(tezosAddress, limit);
    if (!data) {
        hideLoader();
        return;
    }

    const { inflows, outflows, addressToAliasMap } = parseTransactions(data, tezosAddress);
    hideLoaderAndDrawDiagram();
    drawSankeyDiagram(tezosAddress, inflows, outflows, addressToAliasMap);
}

function hideLoaderAndDrawDiagram() {
    document.getElementById('sankey-diagram').style.display = 'block';
    document.getElementById('loader').style.display = 'none';
}

function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}

document.getElementById('confirm-button').addEventListener('click', function() {
    const targetAddress = document.getElementById('target-address').value.trim();
    const limit = document.getElementById('result-limit').value;
    document.getElementById('sankey-diagram').style.display = 'none';
    document.getElementById('loader').style.display = 'block';
    generateDataAndDrawDiagram(targetAddress, limit);
});

document.getElementById('result-limit').addEventListener('input', function() {
    const limitValue = document.getElementById('result-limit').value;
    document.getElementById('limit-value').textContent = limitValue + ' txes';
});

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

    const optimalHeight = Math.max(600, nodes.length * 5);

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
            document.getElementById('confirm-button').click();
        }
    });
}
