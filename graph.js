(function() {
  var MS_PER_DAY = 24*60*60*1000;
  var SEARCH_WINDOW = 2 * MS_PER_DAY;
  var startTime = 0;

  function request(requestId, server, searchdate) {
    startTime = $.now();
    $("#getlogs").attr('disabled', true);

    var around = Date.parse(searchdate);
    var dates = [];
    for (var d = around - SEARCH_WINDOW; d <= around + SEARCH_WINDOW && d < new Date().getTime(); d += MS_PER_DAY) {
      dates.push("logstash-" + new Date(d).toISOString().substring(0, 10).replace("-",".").replace("-","."));
    }

    $.ajax({
      url: server + dates.join(',') + "/_search",
      contentType: "application/json",
      data: {
        q: '+ot-requestid:"' + requestId + '"',
        sort: "@timestamp:asc",
        size: 10000
      },
      server: server,
      requestId: requestId,
      searchdate: searchdate,
      error: onError,
      success: onSuccess
    });
  }

  function go(event) {
    event.preventDefault();
    request($("#requestid").val(), $("#server").val(), $("#searchdate").val());
  }

  google.setOnLoadCallback(function() {
    $("#getlogs").closest('form').submit(go);
    $("#getlogs").prop("disabled", false);

    var url = $.url();
    var server = url.param("server");
    var requestId = url.param("requestId");
    var searchdate = url.param("searchdate");

    if (server) {
      var serverSelect = document.getElementById("server");
      $.each(serverSelect.options, function (idx, option) {
        if (option.value == server) {
          serverSelect.selectedIndex = idx;
        }
      });
    }
    if (requestId) {
      $("#requestid").val(requestId);
      $("#getlogs").closest('form').submit();
    }
    if (searchdate) {
      $("#searchdate").val(searchdate);
    } else {
      $("#searchdate").val(new Date().toISOString().substring(0, 10));
    }
  });

  function onError(jqXHR, textStatus, errorThrown) {
    $("#getlogs").attr('disabled', false);
    alert("Error: " + textStatus + " " + errorThrown);
  }

  function onSuccess(data, textStatus, jqXHR) {
    $("#getlogs").attr('disabled', false);
    history.replaceState({}, this.requestId, "?server=" + encodeURIComponent(this.server) + "&requestId=" + encodeURIComponent(this.requestId) + "&searchdate=" + encodeURIComponent(this.searchdate));

    $("#duration").text(data.took + " ms");
    $("#renderduration").text( ($.now() - startTime - data.took) + " ms");

    var chart = [];
    var tdata = [];

    data.hits.hits.forEach(function(doc) {
      var msg = doc['_source'];
      switch (msg.level) {
      case 'request':
        var when = Date.parse(msg['@timestamp']);
        if (when) {
          var title;
          var referrer = msg.requestServiceName;
          if (referrer) {
            title = referrer + ":" + msg.requestEndpointName;
          } else{
            title = msg.url;
          }
          var cssClass = "httpSuccess";
          var sc = msg.statusCode
          if (sc >= 300 && sc < 400) {
            cssClass = "httpRedirect";
          }
          if (sc >= 400 || typeof sc === 'undefined') {
            cssClass = "httpError";
          }
          chart.push([title, referrer || "unknown", new Date(when - msg.duration/1000), new Date(when), msg, cssClass]);
        } else {
          console.log("Refusing " + JSON.stringify(msg));
        }
        break;
      case 'access':
        break;
      default:
        tdata.push(msg);
        break;
      }
    });

    $("#nreqs").text(chart.length);

    var timeline = new links.Timeline(document.getElementById("graph"));
    var timelineData = new google.visualization.DataTable();

    timelineData.addColumn({ type: "string", id: "content" });
    timelineData.addColumn({ type: "string", id: "group" });
    timelineData.addColumn({ type: "date", id: "start" });
    timelineData.addColumn({ type: "date", id: "end" });
    timelineData.addColumn({ type: "string", id: "msg" });
    timelineData.addColumn({ type: "string", id: "className" });

    timelineData.addRows(chart);

    timeline.draw(timelineData);

    google.visualization.events.addListener(timeline, 'select', function() {
      var sel = timeline.getSelection();
      var row = sel && sel.length ? chart[sel[0].row] : undefined;
      timelineSelect(row);
    });

    $("#logs").dynatable({
      dataset: {
        records: tdata
      }
    });
  }

  function timelineSelect(row) {
    if (row) {
      var msg = row[4];
      var text = "";
      Object.keys(msg).forEach(function(key) {
        text += key + ": " + msg[key] + "<br/>";
      });
      $("#selection").show().html(text);
    } else {
      $("#selection").hide();
    }
  }
})();
