# The Eye of Chad

The Eye of Chad is a small web application that visualizes Tezos blockchain transaction flows with non-zero amounts of tez.

There are two sliders - transaction depth slider and a dust filter slider (for the case when there are too many inputs or outputs)

To explore the connection, click anywhere on a green or red node. It will trigger a new search (or loads the data from cache if already searched) with new address in connection (address is also copied into clipboard for quicker work with it elsewhere). Tool can remember searches and move back and forward between them. Searches can be shared via url.

## Directory Structure

- `index.html` : Main HTML file.
- `css/main.css` : Main CSS file.
- `js/main.js` : Main JS file.
- `icons/` : Directory containing the icon images.

## Questions & Answers
How to copy address/transactions?
- Just click on connection area. Address and all transactions will get copied into clipboard and also printed into browser console automatically

Can I select text in chart area?
- No, it's a limitation of charting library. However we tried to build it in the way that you don't have to. Click on connection copies all needed info and you can instantly return back via Back button

What tx range slider does?
- It's a transaction depth. If you choose 10000, latest 10000 transactions will be analyzed.

What tez slider does?
- It hides the connections with amount less than specified with slider. Useful to filter dust connections and free some chart space or targeting specific ammounts of tez flows

# License
This project is open-source and available under the MIT License.
