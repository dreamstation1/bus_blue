// XML을 JSON으로 변환하는 함수
async function fetchXMLtoJSON(url) {
    try {
        let response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP 오류 ${response.status}`);

        let textData = await response.text(); // XML을 텍스트로 가져옴
        console.log("📥 API 응답:", textData); // 디버깅용 로그

        // XML을 JSON으로 변환하기
        let parser = new DOMParser();
        let xml = parser.parseFromString(textData, "application/xml");

        let json = xmlToJson(xml);
        console.log("🚀 변환된 JSON 데이터:", json);

        return json;
    } catch (error) {
        console.error("🚨 API 요청 실패:", error);
        return null;
    }
}

// XML을 JSON으로 변환하는 함수
function xmlToJson(xml) {
    let obj = {};
    if (xml.nodeType == 1) { // Element
        if (xml.attributes.length > 0) {
            obj["@attributes"] = {};
            for (let j = 0; j < xml.attributes.length; j++) {
                let attribute = xml.attributes.item(j);
                obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
            }
        }
    } else if (xml.nodeType == 3) { // Text
        obj = xml.nodeValue.trim();
    }

    if (xml.hasChildNodes()) {
        for (let i = 0; i < xml.childNodes.length; i++) {
            let item = xml.childNodes.item(i);
            let nodeName = item.nodeName;
            if (typeof obj[nodeName] === "undefined") {
                obj[nodeName] = xmlToJson(item);
            } else {
                if (typeof obj[nodeName].push === "undefined") {
                    let old = obj[nodeName];
                    obj[nodeName] = [];
                    obj[nodeName].push(old);
                }
                obj[nodeName].push(xmlToJson(item));
            }
        }
    }
    return obj;
}

const API_KEY = "QZaklqvKVpzmBpWW4SolKCnjBRjZw15cWSK0UNYnrfzYdHZcYPmvAMIJS1E2SaU%2BOZeITup95X6EjZ%2F5GWe0ZA%3D%3D";

// 🚌 버스 노선 불러오기 (수정된 코드)
async function loadBusRoute() {
    let busRouteId = document.getElementById("bus-select").value;
    console.log("🚌 선택한 노선 ID:", busRouteId);

    let routeContainer = document.getElementById("route-container");
    routeContainer.innerHTML = "<p>🚍 정류장 정보를 불러오는 중...</p>";

    let stations = await getStationList(busRouteId);

    if (!stations.length) {
        routeContainer.innerHTML = "<p>❌ 정류장을 불러오지 못했습니다. (API 오류 또는 노선 정보 없음)</p>";
        return;
    }

    let routeDiv = document.createElement("div");
    routeDiv.classList.add("bus-route");

    stations.forEach((station, index) => {
        let div = document.createElement("div");
        div.classList.add("station");
        div.innerText = station.name;
        div.dataset.index = index;
        routeDiv.appendChild(div);
    });

    routeContainer.innerHTML = "";
    routeContainer.appendChild(routeDiv);
}


// 🚏 정류장 목록 가져오기 (수정된 코드)
async function getStationList(busRouteId) {
    let url = `http://ws.bus.go.kr/api/rest/busRouteInfo/getStaionByRoute?serviceKey=${API_KEY}&busRouteId=${busRouteId}&_type=json`;

    let data = await fetchXMLtoJSON(url); // ✅ XML을 JSON으로 변환

    if (!data || !data.ServiceResult || !data.ServiceResult.msgBody || !data.ServiceResult.msgBody.itemList) {
        console.error("🚨 API 응답이 비어 있음 (노선 ID가 올바른지 확인하세요).");
        return [];
    }

    let stations = data.ServiceResult.msgBody.itemList.map(station => ({
        name: station.stationNm["#text"],
        seq: station.seq["#text"]
    }));

    return stations;
}


// 🚌 실시간 버스 위치 업데이트 (차량 정보 + 이미지 추가)
async function updateBusPosition(busRouteId, stations) {
    let url = `http://ws.bus.go.kr/api/rest/buspos/getBusPosByRtid?serviceKey=${API_KEY}&busRouteId=${busRouteId}&_type=json`;

    try {
        let data = await fetchXMLtoJSON(url);

        if (!data || !data.ServiceResult || !data.ServiceResult.msgBody || !data.ServiceResult.msgBody.itemList) {
            throw new Error("API 응답이 비어 있음 (노선 ID가 올바른지 확인)");
        }

        let buses = data.ServiceResult.msgBody.itemList;
        console.log("🚍 불러온 버스 데이터:", buses);

        // 기존 버스 아이콘 삭제
        document.querySelectorAll(".bus-container").forEach(bus => bus.remove());

        if (!Array.isArray(buses)) {
            buses = [buses]; // 단일 객체일 경우 배열로 변환
        }

        let uniqueBuses = new Map(); // 🚍 중복된 차량번호 제거
        buses.forEach(bus => {
            let vehId = bus.plainNo?.["#text"] || bus.plainNo || "번호 없음";
            if (!uniqueBuses.has(vehId)) {
                uniqueBuses.set(vehId, bus);
            }
        });

        uniqueBuses.forEach(bus => {
            let busSeq = parseInt(bus.sectOrd?.["#text"] || bus.sectOrd, 10) || 0;
            let stationIndex = stations.findIndex(st => st.seq == busSeq);

            if (stationIndex !== -1) {
                let busDiv = document.createElement("div");
                busDiv.classList.add("bus-container");

                // 🚍 차량번호
                let vehId = bus.plainNo?.["#text"] || bus.plainNo || "번호 없음";

                // 🟢 저상 여부
                let lowPlate = (bus.busType?.["#text"] == "1" || bus.busType == "1") ? "저상" : "";

                // 🚦 혼잡도 텍스트로 변환
                let congestionValue = bus.congestion?.["#text"] || bus.congestion || "0";
                let congestionText = { 0: "정보 없음", 3: "여유", 4: "보통", 5: "혼잡", 6: "매우혼잡" };
                let congestion = congestionText[parseInt(congestionValue, 10)] || "정보 없음";

                // 🖼 차량 이미지 (8027, 8030번은 image2 사용)
                let busImage = (vehId === "8027" || vehId === "8030") ? "image2.png" : "image1.png";

                // 🚍 버스 정보 + 이미지 (왼쪽 정렬 및 선 위에 배치)
                busDiv.innerHTML = `
                    <div class="bus-info">
                        <div>${vehId}</div>
                        <div>${lowPlate}</div>
                        <div>${congestion}</div>
                    </div>
                    <img src="${busImage}" class="bus-image">
                `;

                document.querySelectorAll(".station")[stationIndex].appendChild(busDiv);
            } else {
                console.warn(`🚨 버스를 정류장에 배치하지 못함: sectOrd=${busSeq}`);
            }
        });

    } catch (error) {
        console.error("🚨 실시간 버스 위치 업데이트 실패:", error);
        document.getElementById("route-container").innerHTML += `<p>❌ 오류 발생: ${error.message}</p>`;
    }
}

// 🔄 20초마다 실시간 업데이트
setInterval(() => {
    let busRouteId = document.getElementById("bus-select").value;
    if (busRouteId) {
        getStationList(busRouteId).then(stations => {
            if (stations.length) updateBusPosition(busRouteId, stations);
        });
    }
}, 5000);
