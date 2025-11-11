
/*
 * Timeline - ES6 Class
 * @param  parentElement 	-- the HTML element in which to draw the visualization
 * @param  data             -- the movie data to visualize
 * @param  onBrush          -- callback function when brush changes
 */

class Timeline {

    // constructor method to initialize Timeline object
    constructor(parentElement, data, onBrush, onYearHover) {
        this.parentElement = parentElement;
        this.data = data;
        this.onBrush = onBrush; // Callback function to notify parent
        this.onYearHover = onYearHover; // Callback for year hover events
        this.displayData = [];
        this.hoveredYear = null; // Track currently hovered year
        this.animationFrame = null; // For throttling

        this.initVis();
    }

    // create initVis method for Timeline class
    initVis() {
        let vis = this;

        vis.margin = { top: 20, right: 20, bottom: 15, left: 65 };

        // Get the actual width of the container
        let container = document.getElementById(vis.parentElement);
        let containerWidth = container ? container.getBoundingClientRect().width : 1400;

        // Use the full container width minus margins
        vis.width = containerWidth - vis.margin.left - vis.margin.right;
        vis.height = 120 - vis.margin.top - vis.margin.bottom;

        // SVG drawing area
        vis.svg = d3.select("#" + vis.parentElement)
            .attr("width", vis.width + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top + vis.margin.bottom)
            .append("g")
            .attr("transform", `translate(${vis.margin.left}, ${vis.margin.top})`);

        // Scales
        vis.xScale = d3.scaleLinear()
            .range([0, vis.width]);

        vis.yScale = d3.scaleLinear()
            .range([vis.height, 0]);

        // Axes
        vis.xAxis = d3.axisBottom(vis.xScale)
            .tickFormat(d3.format("d"))
            .ticks(10); // Limit number of ticks for better readability

        vis.yAxis = d3.axisLeft(vis.yScale)
            .tickFormat(d => `$${(d / 1000000).toFixed(0)}M`)
            .ticks(5);

        vis.xAxisGroup = vis.svg.append("g")
            .attr("class", "axis x-axis")
            .attr("transform", `translate(0, ${vis.height})`);

        vis.yAxisGroup = vis.svg.append("g")
            .attr("class", "axis y-axis");

        // Add axis labels
        vis.svg.append("text")
            .attr("class", "axis-label")
            .attr("x", vis.width / 2)
            .attr("y", vis.height + vis.margin.bottom + 20)
            .style("text-anchor", "middle")
            .style("font-size", "12px")
            .style("font-weight", "500")
            .style("fill", "#cccccc")
            .text("Year");



        // Add title
        vis.svg.append("text")
            .attr("class", "slider-title")
            .attr("x", vis.width / 2)
            .attr("y", 5)
            .style("text-anchor", "middle")
            .style("font-size", "14px")
            .style("font-weight", "500")
            .style("fill", "#cccccc")
            .text("Average Movie Revenue by Year");

        // Initialize brush component
        vis.brush = d3.brushX()
            .extent([[0, 10], [vis.width, vis.height]])
            .on("brush end", function (event) {
                if (event.selection) {
                    // Convert pixel coordinates to year values
                    let yearRange = event.selection.map(vis.xScale.invert);
                    // Call the callback function with selected range
                    if (vis.onBrush) {
                        vis.onBrush(yearRange);
                    }
                } else {
                    // No selection - reset to null
                    if (vis.onBrush) {
                        vis.onBrush(null);
                    }
                }
            });

        // Append brush component
        vis.brushGroup = vis.svg.append("g")
            .attr("class", "brush");

        // Add double-click to reset brush selection
        vis.svg.on("dblclick", function() {
            vis.brushGroup.call(vis.brush.move, null);
            if (vis.onBrush) {
                vis.onBrush(null);
            }
        });

        // ===== Bidirectional Highlight: Timeline → Scatter =====
        // Create hairline group for year hover indicator
        vis.hairlineGroup = vis.svg.append("g")
            .attr("class", "timeline-hairline")
            .style("pointer-events", "none")
            .style("opacity", 0);

        vis.hairline = vis.hairlineGroup.append("line")
            .attr("y1", 10)
            .attr("y2", vis.height)
            .attr("stroke", "#e50914")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3");

        vis.hairlineLabel = vis.hairlineGroup.append("text")
            .attr("y", 5)
            .attr("text-anchor", "middle")
            .attr("fill", "#e50914")
            .attr("font-size", "11px")
            .attr("font-weight", "600");

        // Add hover tracking area (transparent rect above the timeline)
        vis.hoverArea = vis.svg.append("rect")
            .attr("class", "timeline-hover-area")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", vis.width)
            .attr("height", vis.height)
            .attr("fill", "transparent")
            .style("pointer-events", "all")
            .on("mousemove", function(event) {
                // Throttle with requestAnimationFrame
                if (vis.animationFrame) return;

                vis.animationFrame = requestAnimationFrame(() => {
                    const [mouseX] = d3.pointer(event, this);
                    const hoveredYear = Math.round(vis.xScale.invert(mouseX));

                    // Update hairline position
                    const xPos = vis.xScale(hoveredYear);
                    vis.hairlineGroup
                        .attr("transform", `translate(${xPos}, 0)`)
                        .style("opacity", 1);

                    vis.hairlineLabel.text(hoveredYear);

                    // Notify main chart
                    if (vis.onYearHover && vis.hoveredYear !== hoveredYear) {
                        vis.hoveredYear = hoveredYear;
                        vis.onYearHover(hoveredYear);
                    }

                    vis.animationFrame = null;
                });
            })
            .on("mouseleave", function() {
                // Clear animation frame if pending
                if (vis.animationFrame) {
                    cancelAnimationFrame(vis.animationFrame);
                    vis.animationFrame = null;
                }

                // Hide hairline
                vis.hairlineGroup.style("opacity", 0);

                // Clear hover state
                vis.hoveredYear = null;
                if (vis.onYearHover) {
                    vis.onYearHover(null);
                }
            });

        // Initial data processing
        vis.wrangleData();

        // Add window resize listener
        window.addEventListener('resize', function () {
            vis.handleResize();
        });
    }

    handleResize() {
        let vis = this;

        // Recalculate dimensions
        let container = document.getElementById(vis.parentElement);
        if (container) {
            let containerWidth = container.getBoundingClientRect().width;

            vis.width = containerWidth - vis.margin.left - vis.margin.right;

            // Update SVG dimensions
            vis.svg
                .attr("width", vis.width + vis.margin.left + vis.margin.right)
                .attr("height", vis.height + vis.margin.top + vis.margin.bottom);

            // Update scales
            vis.xScale.range([0, vis.width]);
            vis.yScale.range([vis.height, 0]);

            // Update brush extent
            vis.brush.extent([[0, 0], [vis.width, vis.height]]);

            // Update hover area dimensions
            if (vis.hoverArea) {
                vis.hoverArea.attr("width", vis.width);
            }

            // Update hairline height
            if (vis.hairline) {
                vis.hairline.attr("y2", vis.height);
            }

            // Redraw
            vis.updateVis();
        }
    }

    wrangleData() {
        let vis = this;

        // Filter out invalid data first
        let validData = vis.data.filter(d =>
            d.Gross > 0 &&
            !isNaN(d.Released_Year) &&
            !isNaN(d.Gross) &&
            d.Released_Year > 1900 &&
            d.Released_Year < 2030
        );

        // Calculate average gross revenue per year
        let yearData = d3.rollup(
            validData,
            v => d3.mean(v, d => d.Gross),
            d => d.Released_Year
        );

        vis.displayData = Array.from(yearData, ([year, avgGross]) => ({
            year: year,
            avgGross: avgGross || 0
        }))
            .filter(d => !isNaN(d.avgGross) && d.avgGross > 0)
            .sort((a, b) => a.year - b.year);

        console.log(`Timeline data points: ${vis.displayData.length}`);
        vis.updateVis();
    }

    updateVis() {
        let vis = this;

        if (vis.displayData.length === 0) {
            console.warn("No data to display in timeline");
            return;
        }

        // Update scales - add padding to show full year range
        let minYear = d3.min(vis.displayData, d => d.year);
        let maxYear = d3.max(vis.displayData, d => d.year);

        vis.xScale.domain([minYear - 1, maxYear + 1]);

        vis.yScale.domain([
            0,
            d3.max(vis.displayData, d => d.avgGross) * 1.1
        ]);

        console.log(`Timeline year range: ${minYear} - ${maxYear}`);

        // Update axes
        vis.xAxisGroup.call(vis.xAxis);
        vis.yAxisGroup.call(vis.yAxis);

        // Draw trend line
        let line = d3.line()
            .x(d => vis.xScale(d.year))
            .y(d => vis.yScale(d.avgGross))
            .curve(d3.curveMonotoneX);

        vis.svg.selectAll(".trend-line")
            .data([vis.displayData])
            .join("path")
            .attr("class", "trend-line")
            .attr("d", line);

        // Apply brush
        vis.brushGroup.call(vis.brush);
    }

    // Method to highlight a specific year (bidirectional highlight: scatter → timeline)
    highlightYearOnTimeline(year) {
        let vis = this;

        // Remove existing pulse marker
        vis.svg.selectAll(".year-pulse").remove();

        if (year === null) return;

        // Create pulse marker at the year position
        const xPos = vis.xScale(year);
        const yPos = vis.height / 2;

        // Add pulsing circle marker
        vis.svg.append("circle")
            .attr("class", "year-pulse")
            .attr("cx", xPos)
            .attr("cy", yPos)
            .attr("r", 0)
            .attr("fill", "none")
            .attr("stroke", "#e50914")
            .attr("stroke-width", 2)
            .style("pointer-events", "none")
            .transition()
            .duration(400)
            .ease(d3.easeCircleOut)
            .attr("r", 15)
            .attr("stroke-width", 1)
            .attr("opacity", 0.8)
            .transition()
            .duration(200)
            .attr("opacity", 0)
            .remove();

        // Add year label highlight
        vis.svg.append("text")
            .attr("class", "year-pulse")
            .attr("x", xPos)
            .attr("y", yPos)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#e50914")
            .attr("font-size", "12px")
            .attr("font-weight", "700")
            .style("pointer-events", "none")
            .text(year)
            .transition()
            .duration(600)
            .attr("opacity", 0)
            .remove();
    }
}