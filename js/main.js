async function fetchData(tezosAddress, limit = 1000, offset = 0) {
            try {
                const response = await fetch(`https://api.tzkt.io/v1/accounts/${tezosAddress}/operations?sort.desc=level&limit=1000&offset=${offset}`);
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

            if (!data || !Array.isArray(data)) {
                console.error('Invalid data format');
                return { inflows: [], outflows: [] };
            }

            data.forEach(operation => {
                if (operation.sender && operation.target && operation.sender.address === tezosAddress && operation.amount !== "0") {
                    const targetAddress = operation.target.address;
                    const amount = parseFloat(operation.amount / 1000000);
                    if (outflowsMap.has(targetAddress)) {
                        outflowsMap.set(targetAddress, outflowsMap.get(targetAddress) + amount);
                    } else {
                        outflowsMap.set(targetAddress, amount);
                    }
                }
                if (operation.target && operation.target.address === tezosAddress && operation.sender.address !== tezosAddress) {
                    const senderAddress = operation.sender.address;
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

            return { inflows, outflows };
        }

        async function generateDataAndDrawDiagram(tezosAddress, limit) {
            const data = await fetchAllData(tezosAddress, limit);
            if (!data) {
                hideLoader();
                return;
            }

            const { inflows, outflows } = parseTransactions(data, tezosAddress);
            hideLoaderAndDrawDiagram();
            drawSankeyDiagram(tezosAddress, inflows, outflows);
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
            document.getElementById('limit-value').textContent = limitValue;
        });

        
        document.getElementById('limit-value').textContent = document.getElementById('result-limit').value;

        function drawSankeyDiagram(targetAddress, inflows, outflows) {
            const nodes = [
                { label: targetAddress },
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

            Plotly.newPlot('sankey-diagram', [sankeyData], {
                margin: { t: 0, r: 0, b: 0, l: 0 }, 
                width: window.innerWidth, 
                height: 600
            });

            const sankeyContainer = document.getElementById('sankey-diagram');
            sankeyContainer.on('plotly_click', function(event) {
                if (event && event.points && event.points.length > 0) {
				if (event.points[0].source.pointNumber!=0)
                    clickedNodeLabel = event.points[0].source.label;
					else
					clickedNodeLabel = event.points[0].target.label;
					console.log(event.points);
                    const labelValue = (typeof clickedNodeLabel === 'object') ? clickedNodeLabel.text : clickedNodeLabel;
                    document.getElementById('target-address').value = labelValue.trim();
					document.getElementById('confirm-button').click();
                }
            });
        }
