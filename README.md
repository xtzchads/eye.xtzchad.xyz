# The Eye of Chad

The Eye of Chad is a small web application that visualizes Tezos blockchain transactions flows with non-zero amounts of tez.

There are two sliders - transaction depth slider and a dust filter slider (for the case when there are too many inputs or outputs)

To explore the connection, click anywhere on a green or red node. It will trigger a new search (or loads the data from cache if already searched) with new address in connection (address is also copied into clipboard for quicker work with it elsewhere). Tool can remember searches and move back and forward between them. Searches can be shared via url.

## Directory Structure

- `index.html` : Main HTML file.
- `css/main.css` : Main CSS file.
- `js/main.js` : Main JS file.
- `icons/` : Directory containing the icon images.

# License
This project is open-source and available under the MIT License.
