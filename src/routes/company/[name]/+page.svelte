<script>
  import { onMount } from "svelte";
  import Chart from "chart.js/auto";
  import { goto } from "$app/navigation";
  export let data;

  /** @type {HTMLCanvasElement | null} */
  let canvasEl;
  /** @type {HTMLCanvasElement | null} */
  let ownershipCanvasEl;
  const { symbol, companyName, priceData, ownershipData, basicStats } = data;

  let selectedTimeRange = "3M";
  /** @type {import('chart.js').Chart | null} */
  let priceChart = null;
  let searchQuery = "";
  let currentPage = 1;
  let itemsPerPage = 10;
  let sortColumn = "filingDate";
  let sortDirection = "desc";
  /** @type {number | null} */
  let priceChangePct = null;

  function goBack() {
    goto("/");
  }

  // Filter and sort ownership data
  $: filteredOwnershipData = (() => {
    if (!ownershipData || !Array.isArray(ownershipData)) return [];

    let filtered = ownershipData.filter((row) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (row.name || "").toLowerCase().includes(query);
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];

      if (sortColumn === "filingDate") {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      } else {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      }

      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });

    return filtered;
  })();

  // Pagination
  $: totalPages = Math.ceil(filteredOwnershipData.length / itemsPerPage);
  $: paginatedData = filteredOwnershipData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  /**
   * @param {string} timeRange
   */
  function updateChart(timeRange) {
    selectedTimeRange = timeRange;
    if (!canvasEl || !priceData?.historical?.length || !priceChart) return;

    const now = new Date();
    let cutoffDate = new Date();

    switch (timeRange) {
      case "3M":
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      case "6M":
        cutoffDate.setMonth(now.getMonth() - 6);
        break;
      case "YTD":
        cutoffDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "1Y":
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      case "3Y":
        cutoffDate.setFullYear(now.getFullYear() - 3);
        break;
      case "5Y":
        cutoffDate.setFullYear(now.getFullYear() - 5);
        break;
      case "10Y":
        cutoffDate.setFullYear(now.getFullYear() - 10);
        break;
      case "ALL":
        cutoffDate = new Date(0);
        break;
    }

    const filtered = priceData.historical.filter(
      (/** @type {{date: string}} */ h) => {
        const date = new Date(h.date);
        return date >= cutoffDate;
      }
    );

    const labels = filtered
      .map((/** @type {{date: string}} */ h) => h.date)
      .reverse();
    const closes = filtered
      .map((/** @type {{close: number}} */ h) => h.close)
      .reverse();

    priceChart.data.labels = labels;
    priceChart.data.datasets[0].data = closes;
    priceChart.update();

    if (closes.length >= 2) {
      const first = closes[0];
      const last = closes[closes.length - 1];
      priceChangePct = first ? ((last - first) / first) * 100 : null;
    } else {
      priceChangePct = null;
    }
  }

  /**
   * @param {string} column
   */
  function sortTable(column) {
    if (sortColumn === column) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortColumn = column;
      sortDirection = "desc";
    }
    currentPage = 1;
  }

  /**
   * @param {number} page
   */
  function goToPage(page) {
    currentPage = Math.max(1, Math.min(page, totalPages));
  }

  onMount(() => {
    // Price chart
    if (canvasEl && priceData?.historical?.length) {
      const labels = priceData.historical
        .map((/** @type {{date: string}} */ h) => h.date)
        .reverse();
      const closes = priceData.historical
        .map((/** @type {{close: number}} */ h) => h.close)
        .reverse();

      priceChart = new Chart(canvasEl, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "",
              data: closes,
              borderColor: "#e46357",
              borderWidth: 2,
              pointRadius: 1,
              pointHoverRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: false,
            },
          },
        },
      });

      // Set initial time range
      updateChart(selectedTimeRange);
    }
  });

  /**
   * @param {number | null | undefined} n
   */
  function fmt(n) {
    return n == null ? "—" : Intl.NumberFormat().format(n);
  }

  /**
   * @param {string | null | undefined} dateStr
   */
  function formatDate(dateStr) {
    if (!dateStr) return "—";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  /**
   * @param {number | null | undefined} value
   * @param {string} [currency='USD']
   */
  function formatCurrency(value, currency = "USD") {
    if (value == null) return "—";
    return Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: value >= 1 ? 2 : 4,
    }).format(value);
  }

  /**
   * @param {number | null | undefined} value
   */
  function formatLargeNumber(value) {
    if (value == null) return "—";
    const units = [
      { label: "T", value: 1e12 },
      { label: "B", value: 1e9 },
      { label: "M", value: 1e6 },
      { label: "K", value: 1e3 },
    ];
    for (const unit of units) {
      if (value >= unit.value) {
        return `${(value / unit.value).toFixed(2)}${unit.label}`;
      }
    }
    return Intl.NumberFormat().format(value);
  }
</script>

<div class="company-page">
  <div class="header">
    <button
      class="back-button"
      on:click={goBack}
      aria-label="Back to search"
    >
      ← Back
    </button>
    <h1>{companyName || symbol} | {symbol}</h1>
  </div>

  <div class="chart-layout">
    <aside class="stats-board">
      <div class="stats-header">
        <h2>Basic Stats</h2>
        <span class="currency-pill">{basicStats?.currency || "USD"}</span>
      </div>
      <div class="stats-grid">
        <div class="stat-item">
          <p>Price</p>
          <strong
            >{formatCurrency(basicStats?.price, basicStats?.currency)}</strong
          >
        </div>
        <div class="stat-item">
          <p>52 Week Low</p>
          <strong
            >{formatCurrency(
              basicStats?.fiftyTwoWeekLow,
              basicStats?.currency
            )}</strong
          >
        </div>
        <div class="stat-item">
          <p>52 Week High</p>
          <strong
            >{formatCurrency(
              basicStats?.fiftyTwoWeekHigh,
              basicStats?.currency
            )}</strong
          >
        </div>
        <div class="stat-item">
          <p>Market Cap</p>
          <strong>{formatLargeNumber(basicStats?.marketCap)}</strong>
        </div>
        <div class="stat-item">
          <p>Shares Outstanding</p>
          <strong>{formatLargeNumber(basicStats?.sharesOutstanding)}</strong>
        </div>
        <div class="stat-item">
          <p>Free Float</p>
          <strong>{formatLargeNumber(basicStats?.freeFloat)}</strong>
        </div>
        <div class="stat-item">
          <p>Avg. Trading Volume</p>
          <strong>{formatLargeNumber(basicStats?.avgTradingVolume)}</strong>
        </div>
      </div>
    </aside>

    <div class="chart-section">
      <div class="chart-header">
        <div class="chart-title">
          <h2>Price Chart</h2>
          <div class="time-range-buttons">
            <button
              class:active={selectedTimeRange === "3M"}
              on:click={() => updateChart("3M")}>3M</button
            >
            <button
              class:active={selectedTimeRange === "6M"}
              on:click={() => updateChart("6M")}>6M</button
            >
            <button
              class:active={selectedTimeRange === "YTD"}
              on:click={() => updateChart("YTD")}>YTD</button
            >
            <button
              class:active={selectedTimeRange === "1Y"}
              on:click={() => updateChart("1Y")}>1Y</button
            >
            <button
              class:active={selectedTimeRange === "3Y"}
              on:click={() => updateChart("3Y")}>3Y</button
            >
            <button
              class:active={selectedTimeRange === "5Y"}
              on:click={() => updateChart("5Y")}>5Y</button
            >
            <button
              class:active={selectedTimeRange === "10Y"}
              on:click={() => updateChart("10Y")}>10Y</button
            >
            <button
              class:active={selectedTimeRange === "ALL"}
              on:click={() => updateChart("ALL")}>ALL</button
            >
          </div>
        </div>
        <div class="chart-change">
          {#if priceChangePct != null}
            Change: <span class:negative={priceChangePct < 0}
              >{priceChangePct.toFixed(2)}%</span
            >
          {/if}
        </div>
      </div>
      <div class="chart-container">
        <canvas bind:this={canvasEl}></canvas>
      </div>
    </div>
  </div>

  <div class="ownership-section">
    <h2>Acquisition of Beneficial Ownership</h2>
    <div class="ownership-controls">
      <div class="search-box">
        <input
          type="text"
          placeholder="Search by name"
          bind:value={searchQuery}
        />
      </div>
      {#if filteredOwnershipData.length > 0}
        <div class="pagination top">
          <button disabled={currentPage === 1} on:click={() => goToPage(1)}
            >&lt;&lt;</button
          >
          <button
            disabled={currentPage === 1}
            on:click={() => goToPage(currentPage - 1)}>&lt;</button
          >
          {#each Array(Math.min(5, totalPages)) as _, i}
            {@const page =
              currentPage <= 3
                ? i + 1
                : currentPage >= totalPages - 2
                  ? totalPages - 4 + i
                  : currentPage - 2 + i}
            {#if page >= 1 && page <= totalPages}
              <button
                class:active={currentPage === page}
                on:click={() => goToPage(page)}>{page}</button
              >
            {/if}
          {/each}
          <button
            disabled={currentPage === totalPages}
            on:click={() => goToPage(currentPage + 1)}>&gt;</button
          >
          <button
            disabled={currentPage === totalPages}
            on:click={() => goToPage(totalPages)}>&gt;&gt;</button
          >
        </div>
      {/if}
    </div>

    {#if filteredOwnershipData.length > 0}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th class="sortable" on:click={() => sortTable("name")}>
                Name
                {#if sortColumn === "name"}
                  {sortDirection === "asc" ? " ↑" : " ↓"}
                {:else}
                  ↕
                {/if}
              </th>
              <th class="sortable" on:click={() => sortTable("sharesOwned")}>
                Shares Owned
                {#if sortColumn === "sharesOwned"}
                  {sortDirection === "asc" ? " ↑" : " ↓"}
                {:else}
                  ↕
                {/if}
              </th>
              <th
                class="sortable"
                on:click={() => sortTable("ownershipPercentage")}
              >
                Ownership Percentage
                {#if sortColumn === "ownershipPercentage"}
                  {sortDirection === "asc" ? " ↑" : " ↓"}
                {:else}
                  ↕
                {/if}
              </th>
              <th
                class="sortable"
                on:click={() => sortTable("soleVotingPower")}
              >
                Sole Voting Power
                {#if sortColumn === "soleVotingPower"}
                  {sortDirection === "asc" ? " ↑" : " ↓"}
                {:else}
                  ↕
                {/if}
              </th>
              <th
                class="sortable"
                on:click={() => sortTable("sharedVotingPower")}
              >
                Shared Voting Power
                {#if sortColumn === "sharedVotingPower"}
                  {sortDirection === "asc" ? " ↑" : " ↓"}
                {:else}
                  ↕
                {/if}
              </th>
              <th
                class="sortable"
                on:click={() => sortTable("soleDispositivePower")}
              >
                Sole Dispositive Power
                {#if sortColumn === "soleDispositivePower"}
                  {sortDirection === "asc" ? " ↑" : " ↓"}
                {:else}
                  ↕
                {/if}
              </th>
              <th
                class="sortable"
                on:click={() => sortTable("sharedDispositivePower")}
              >
                Shared Dispositive Power
                {#if sortColumn === "sharedDispositivePower"}
                  {sortDirection === "asc" ? " ↑" : " ↓"}
                {:else}
                  ↕
                {/if}
              </th>
              <th class="sortable" on:click={() => sortTable("filingDate")}>
                Filing Date
                {#if sortColumn === "filingDate"}
                  {sortDirection === "asc" ? " ↑" : " ↓"}
                {:else}
                  ↕
                {/if}
              </th>
            </tr>
          </thead>
          <tbody>
            {#each paginatedData as row}
              <tr>
                <td>{row.name ?? "—"}</td>
                <td>{fmt(row.sharesOwned)}</td>
                <td>{fmt(row.ownershipPercentage)}</td>
                <td>{fmt(row.soleVotingPower)}</td>
                <td>{fmt(row.sharedVotingPower)}</td>
                <td>{fmt(row.soleDispositivePower)}</td>
                <td>{fmt(row.sharedDispositivePower)}</td>
                <td>{formatDate(row.filingDate)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="no-data">No ownership data available.</p>
    {/if}
  </div>
</div>

<style>
  .company-page {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
    background: white;
  }

  .header {
    position: relative;
    background: #0a2640;
    color: white;
    padding: 1.5rem;
    text-align: center;
  }

  .header h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  .back-button {
    position: absolute;
    right: 1.5rem;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.15);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.4);
    padding: 0.4rem 0.9rem;
    border-radius: 999px;
    cursor: pointer;
    font-size: 0.85rem;
    line-height: 0.85rem;
    font-family:
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
    font-weight: 500;
  }

  .back-button:hover {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.6);
  }

  .chart-layout {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    margin-bottom: 3rem;
    padding: 1rem;
    background: #0a2640;
    background: linear-gradient(
      180deg,
      rgba(10, 38, 64, 1) 0%,
      rgba(10, 38, 64, 1) 50%,
      rgb(223, 238, 248, 1) 50%,
      rgba(223, 238, 248, 1) 100%
    );
  }

  .stats-board {
    background: whitesmoke;
    border-radius: 12px;
    padding: 1.25rem;
    min-width: 260px;
    flex: 1 1 260px;
    max-width: 320px;
    border: 1px solid rgba(60, 31, 130, 0.08);
    box-shadow: 0 8px 24px rgba(60, 31, 130, 0.08);
  }

  .stats-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    font-weight: 600;
  }

  .currency-pill {
    font-family:
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
    background: #ada0d4;
    color: whitesmoke;
    padding: 0.5rem 1.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
    padding-top: 1rem;
  }

  .stat-item {
    font-family:
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .stat-item p {
    margin: 0;
    font-size: 0.85rem;
    color: #5f5f7a;
  }

  .stat-item strong {
    display: block;
    margin-top: 0.25rem;
    font-size: 1rem;
    color: #535353;
  }

  .chart-section {
    background: whitesmoke;
    border-radius: 12px;
    padding: 1.25rem;
    flex: 3 1 480px;
    min-width: 0;
  }

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .chart-header h2,
  .stats-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .time-range-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .time-range-buttons button {
    padding: 0.25rem 0.5rem;
    border: 1px solid #ddd;
    background: lightgray;
    cursor: pointer;
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .time-range-buttons button:hover {
    background: #f5f5f5;
  }

  .time-range-buttons button.active {
    background: #e46357;
    color: white;
    border-color: #e46357;
  }

  .chart-container {
    height: 400px;
    position: relative;
  }

  .chart-title {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .chart-change {
    font-family:
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
    font-size: 0.875rem; /* match time-range-buttons font size */
    font-weight: 400;
  }

  .chart-change span {
    color: #1b5e20;
    font-weight: 600;
  }

  .chart-change span.negative {
    color: #c62828;
  }

  .ownership-section {
    margin-top: 3rem;
  }

  .ownership-section h2 {
    font-size: 1.25rem;
    margin-bottom: 1rem;
  }

  .ownership-controls {
    margin-bottom: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .search-box input {
    padding: 0.5rem 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.875rem;
    width: 300px;
  }

  .table-container {
    overflow-x: auto;
    margin-bottom: 1rem;
    border-radius: 8px;
    border: 1px solid #ddd; /* outer border */
    background: white;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    font-family:
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
  }

  th {
    background-color: #e3f2fd;
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.875rem;
    border: 1px solid #ddd;
    white-space: nowrap;
  }

  th.sortable {
    cursor: pointer;
    user-select: none;
  }

  th.sortable:hover {
    background-color: #bbdefb;
  }

  td {
    padding: 0.75rem;
    border-bottom: 1px solid #ddd;
    border-top: none;
    border-left: none;
    border-right: none;
    font-size: 0.875rem;
    font-family:
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
  }

  tbody tr:nth-child(even) {
    background-color: #f9f9f9;
  }

  tbody tr:nth-child(odd) {
    background-color: white;
  }

  tbody tr:hover {
    background-color: #f0f0f0;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
  }

  .pagination button {
    padding: 0.5rem 0.75rem;
    border: 0px solid #ddd;
    background: white;
    cursor: pointer;
    border-radius: 8px;
    font-size: 0.875rem;
    min-width: 30px;
    font-weight: 600;
    color: #535353;
  }

  .pagination button:hover:not(:disabled) {
    background: #bbdefb;
  }

  .pagination button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pagination button.active {
    background: white;
    color: 535353;
    border: 1px solid #535353;
  }

  .no-data {
    text-align: center;
    padding: 2rem;
    color: #666;
    font-style: italic;
  }

  @media (max-width: 900px) {
    .chart-layout {
      flex-direction: column;
    }

    .stats-board {
      max-width: 100%;
    }
  }
</style>
