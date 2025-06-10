const API_URL = 'https://gorgonprice.duckdns.org/api/prices';
// Global variables
let itemsData = {};
let priceChart = null;
let showTrendLine = false;

// DOM elements
const itemList = document.getElementById('itemList');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const priceChartCtx = document.getElementById('priceChart').getContext('2d');
const selectedItemTitle = document.getElementById('selectedItemTitle');
//const fileInput = document.getElementById('fileInput');
//const loadFilesBtn = document.getElementById('loadFilesBtn');
const loadingSpinner = document.getElementById('loadingSpinner'); // Properly defined now
const startDate = document.getElementById('startDate');
const endDate = document.getElementById('endDate');
const toggleTrendLine = document.getElementById('toggleTrendLine');

// Initialize the app
async function init() {
    try {
        setupEventListeners();
        setDefaultDates();
        await loadPriceData();
    } catch (error) {
        
        
    }
}

// Set default date range (last 30 days)
function setDefaultDates() {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    startDate.valueAsDate = thirtyDaysAgo;
    endDate.valueAsDate = today;
}

// Setup event listeners
function setupEventListeners() {
    // Search as you type
    searchInput.addEventListener('input', handleSearch);
    // Search button click
    searchBtn.addEventListener('click', handleSearch);
    
    // Enter key in search input
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    
    // Load files button
    //loadFilesBtn.addEventListener('click', handleFileLoad);
    
    // Date filter changes
   startDate.addEventListener('change', updateChartIfItemSelected);
    endDate.addEventListener('change', updateChartIfItemSelected);
    
    // Trend line toggle
    toggleTrendLine.addEventListener('click', () => {
        showTrendLine = !showTrendLine;
        toggleTrendLine.classList.toggle('btn-secondary', !showTrendLine);
        toggleTrendLine.classList.toggle('btn-primary', showTrendLine);
        updateChartIfItemSelected();
    });
}

function updateChartIfItemSelected() {
    const selectedItem = document.querySelector('#itemList .active');
    if (selectedItem) {
        displayPriceHistory(selectedItem.textContent);
    }
}

async function loadPriceData() {
    try {
        loadingSpinner.style.display = 'block';
        
        const response = await fetch(API_URL, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const responseData = await response.json();
        
        if (responseData.status === 'success') {
            itemsData = responseData.data;
            populateItemList(Object.keys(itemsData).sort());
            
            // Log for debugging
            console.log('Loaded price data:', {
                itemsCount: Object.keys(itemsData).length,
                sampleItem: Object.keys(itemsData)[0],
                sampleData: itemsData[Object.keys(itemsData)[0]]
            });
        } else {
            throw new Error('Server returned unsuccessful status');
        }
        
    } catch (error) {
        console.error('Error loading price data:', error);
        alert('Failed to load price data. Please try again later.');
        
        // If you have fallback data loading mechanism, call it here
        // await loadDataFromGitHub();
    } finally {
        loadingSpinner.style.display = 'none';
    }
}


// Handle file loading
async function loadDataFromGitHub() {
    try {
        loadingSpinner.style.display = 'block';
        
        const response = await fetch('https://api.github.com/repos/happymaj00r/GorgonPrice/contents/Data');
        if (!response.ok) {
            throw new Error('Failed to fetch file list from GitHub');
        }
        
        const files = await response.json();
        const textFiles = files.filter(file => file.name.endsWith('.txt'));
        
        if (textFiles.length === 0) {
            throw new Error('No text files found in repository');
        }
        
        // Process each file sequentially to avoid rate limits
        for (const file of textFiles) {
            try {
                const fileResponse = await fetch(file.download_url);
                if (!fileResponse.ok) {
                    console.warn(`Failed to fetch file ${file.name}`);
                    continue;
                }
                
                const content = await fileResponse.text();
                processFileData(content, file.name);
            } catch (error) {
                console.error(`Error processing file ${file.name}:`, error);
            }
        }
        
        populateItemList(Object.keys(itemsData).sort());
        loadingSpinner.style.display = 'none';
        
    } catch (error) {
        console.error('Error loading data:', error);
        loadingSpinner.style.display = 'none';
        alert(`Error loading price data: ${error.message}`);
    }
}
function handleFileLoad() {
    loadFilesFromServer();
    // Uncomment the next line to enable file input loading
    return; // Disable file input loading for now
    const files = fileInput.files;
    if (files.length === 0) {
        alert('Please select at least one file');
        return;
    }
    
    itemsData = {}; // Reset data
    
    const fileReaders = Array.from(files).map(file => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                processFileData(e.target.result, file.name);
                resolve();
            };
            reader.readAsText(file);
        });
    });
    
    Promise.all(fileReaders).then(() => {
        populateItemList(Object.keys(itemsData).sort());
        alert(`Successfully loaded ${files.length} files with ${Object.keys(itemsData).length} unique items`);
    });
}

// Process data from a single file
function processFileData(fileData, fileName) {
    // Try to extract date from filename if in format "ShopsYYYY-MM-DD--HH-MM-SS.txt"
    let fileDate = null;
    const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})--\d{2}-\d{2}-\d{2}/);
    if (dateMatch) {
        fileDate = new Date(dateMatch[1]);
    }
    
    const lines = fileData.split('\n');
    lines.forEach(line => {
        if (!line.trim()) return;
        
        const parts = line.split(':');
        if (parts.length >= 3) {
            const name = parts[0].trim();
            const price = parseInt(parts[1].trim(), 10);
            let date = fileDate;
            
            // If no date in filename, try to get it from the line
            if (!date && parts[2]) {
                const lineDateMatch = parts[2].match(/(\d{4}-\d{2}-\d{2})/);
                if (lineDateMatch) {
                    date = new Date(lineDateMatch[0]);
                }
            }
            
            // Fallback to current date if no date found
            if (!date) {
                date = new Date();
            }
            
            if (!isNaN(price)) {
                if (!itemsData[name]) {
                    itemsData[name] = [];
                }
                itemsData[name].push({
                    price: price,
                    date: date
                });
            }
        }
    });
}

// Handle search
function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase();
    const filteredItems = Object.keys(itemsData).filter(item => 
        item.toLowerCase().includes(searchTerm)
    );
    populateItemList(filteredItems.sort());
}

// Populate the item list
function populateItemList(items) {
    itemList.innerHTML = '';
    
    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'list-group-item list-group-item-action';
        li.textContent = item;
        li.addEventListener('click', function() {
            // Remove active class from all items
            document.querySelectorAll('#itemList li').forEach(el => {
                el.classList.remove('active');
            });
            // Add active class to clicked item
            this.classList.add('active');
            displayPriceHistory(item);
        });
        itemList.appendChild(li);
    });
}

// Display price history for selected item
function displayPriceHistory(itemName) {
    const pricesData = itemsData[itemName];
    if (!pricesData || pricesData.length === 0) return;
    
    // Sort by date
    const sortedData = [...pricesData].sort((a, b) => a.date - b.date);
    
    // Apply date filter
    const startDateVal = startDate.valueAsDate;
    const endDateVal = endDate.valueAsDate;
    
    const filteredData = sortedData.filter(entry => {
        const entryDate = new Date(entry.date);
        return true;
    });
    
    if (filteredData.length === 0) {
        alert('No data available for the selected date range');
        return;
    }
    
    selectedItemTitle.textContent = `${itemName} Price History`;
    
    // Prepare chart data
    const labels = filteredData.map(entry => entry.date);
    const dataPoints = filteredData.map(entry => entry.price);
    
    // Calculate trend line if enabled
    let trendLineData = null;
    if (showTrendLine && filteredData.length > 1) {
        trendLineData = calculateTrendLine(filteredData);
    }
    
    // Destroy previous chart if exists
    if (priceChart) {
        priceChart.destroy();
    }
    
    // Create new chart
    priceChart = new Chart(priceChartCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: `Price (${itemName})`,
                    data: dataPoints,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    tension: 0.1,
                    fill: true,
                    borderWidth: 2
                },
                ...(trendLineData ? [{
                    label: 'Trend Line',
                    data: trendLineData,
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                }] : [])
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        tooltipFormat: 'MMM d, yyyy'
                    },
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Price'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${itemName}: ${context.parsed.y}`;
                        }
                    }
                }
            }
        }
    });
}

// Calculate linear trend line data
function calculateTrendLine(data) {
    // Simple linear regression
    const xValues = data.map((_, i) => i);
    const yValues = data.map(entry => entry.price);
    
    const n = xValues.length;
    const xSum = xValues.reduce((a, b) => a + b, 0);
    const ySum = yValues.reduce((a, b) => a + b, 0);
    const xySum = xValues.reduce((a, x, i) => a + x * yValues[i], 0);
    const xxSum = xValues.reduce((a, b) => a + b * b, 0);
    
    const slope = (n * xySum - xSum * ySum) / (n * xxSum - xSum * xSum);
    const intercept = (ySum - slope * xSum) / n;
    
    return xValues.map(x => slope * x + intercept);
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Initialize the app when DOM is loaded

